import {
  BrowserContext, Page,
} from 'playwright';
import { HydratedDocument } from 'mongoose';

import { GPTService } from '../chatgpt/chatgpt.service';

import { VacancyApplicationModel } from '../vacancy-application/vacancy-applications.model';
import { VacancyApplicationDocument, VacancyApplicationStatus } from '../vacancy-application/vacancy-applications.types';

import { hasContactPattern, sleep } from '../../common/utils/common';
import { logger } from '../../common/logger';
import { TG_CHAT_ID } from '../../common/constants/common';
import { AppException } from '../../common/exceptions';

import { bot } from '../../bot/bot';

import { ChatMessage, IVacancyChatService } from './vacancy.types';

export class VacancyChatService implements IVacancyChatService {
  constructor(
    private browserContext: BrowserContext,
    private gptService: GPTService,
  ) {}

  public async processChats(): Promise<void> {
    const page: Page = await this.browserContext.newPage();

    try {
      await page.goto('https://hh.ru/chat', {
        waitUntil: 'domcontentloaded',
        timeout: 120000,
      });

      const chatExists = await page.$('[data-qa^="chatik-open-chat-"]');

      if (!chatExists) {
        await page.close();

        return;
      }

      await VacancyChatService.ensureUnreadFilterActive(page);

      await page.waitForSelector('[data-qa^="chatik-open-chat-"]');

      const chatLinks = await page.$$eval(
        '[data-qa^="chatik-open-chat-"]',
        (els) => els.map((el) => (el as HTMLAnchorElement).href),
      );

      logger.info(`Collected ${chatLinks.length} unread chat links`);

      for (const chatUrl of chatLinks) {
        const openedPage = await this.processChatPage(chatUrl);

        await openedPage.close();
      }

      await page.close();
    } catch (err) {
      logger.error('CHAT_SERVICE_ERROR', err);

      throw new AppException('CHAT_SERVICE_ERROR', { cause: err });
    }
  }

  private async processChatPage(chatUrl: string): Promise<Page> {
    const page: Page = await this.browserContext.newPage();

    await page.goto(chatUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });

    await page.waitForSelector('[data-qa^="chatik-chat-message-"]');

    const vacancyUrl = await VacancyChatService.extractVacancyUrlFromChatPage(page);

    let vacancy: HydratedDocument<VacancyApplicationDocument> | null = null;

    if (vacancyUrl) {
      vacancy = await VacancyApplicationModel.findOne({ link: vacancyUrl });
    }

    if (!vacancy) {
      vacancy = await VacancyApplicationModel.findOne({ chatLink: chatUrl });

      if (!vacancy) {
        vacancy = new VacancyApplicationModel({
          link: chatUrl,
          type: 'chat',
          status: VacancyApplicationStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await vacancy.save();
      }
    }

    const status = await VacancyChatService.getChatStatus(page, chatUrl);

    if (status) {
      vacancy.status = status;
      vacancy.updatedAt = new Date();

      await vacancy.save();
    }

    if (vacancy.status === VacancyApplicationStatus.REJECTION) return page;

    const input = page.locator('[data-qa="chatik-new-message-text"]');

    if (!await input.count()) return page;

    await this.handleChat(page, vacancy);

    return page;
  }

  private static async getChatStatus(
    page: Page,
    url: string,
  ): Promise<VacancyApplicationStatus | null> {
    const chatLink = page.locator(`a[href="${url}"]`);

    if (await chatLink.count() === 0) return null;

    const tagEl = chatLink.locator('[class*="last-message--"]');

    if (await tagEl.count() === 0) return null;

    const tagText = (await tagEl.innerText()).trim();

    if (tagText.includes('Отказ')) return VacancyApplicationStatus.REJECTION;
    if (tagText.includes('Собеседование')) return VacancyApplicationStatus.INTERVIEW;

    return null;
  }

  private static async ensureUnreadFilterActive(page: Page): Promise<void> {
    await page.waitForSelector('[data-qa="chatik-checkbox-only-unread"]');

    const checkbox = page.locator('[data-qa="chatik-checkbox-only-unread"]');
    const isChecked = await checkbox.isChecked();

    if (!isChecked) {
      await checkbox.click();

      const loader = page.locator('[class*="loader--"]');

      await loader.waitFor({ state: 'attached', timeout: 3000 }).catch(() => {});
      await loader.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
    }
  }

  private static async extractVacancyUrlFromChatPage(page: Page): Promise<string | null> {
    try {
      const vacancyLink = page.locator('[data-qa="chatik-header-vacancy-link"]');

      if ((await vacancyLink.count()) === 0) return null;

      const href = await vacancyLink.getAttribute('href');

      if (!href) return null;

      const url = new URL(href);

      return `${url.origin}${url.pathname}`;
    } catch {
      return null;
    }
  }

  private static findMessageWithContact(messages: ChatMessage[]): ChatMessage | null {
    return messages.slice().reverse().find((m) => m.author === 'hr' && hasContactPattern(m.text)) ?? null;
  }

  private async handleChat(page: Page, vacancy: HydratedDocument<VacancyApplicationDocument>): Promise<void> {
    const messages = await VacancyChatService.parseMessages(page);
    const lastMessage = messages[messages.length - 1] ?? null;

    if (!lastMessage) return;

    const savedLastMessage = vacancy?.lastMessage;

    const hasNewHrMessage = lastMessage.author === 'hr'
      && lastMessage.text !== savedLastMessage;

    if (savedLastMessage && !hasNewHrMessage) {
      console.log('No new HR messages, skipping reply');

      return;
    }

    const reply = await this.gptService.generateChatReply(lastMessage.text);

    if (reply.type === 'none') return;

    if (reply.type === 'interview') {
      bot.sendMessage(TG_CHAT_ID, `
        Ура ура! Тебя пригласили на собес!\n\n
        Компания: ${reply.company}\n\n
        Контакты: ${reply.contact}\n\n
        Сообщение: ${lastMessage.text}
      `);
    } else {
      const chatMessage = VacancyChatService.findMessageWithContact(messages);

      if (chatMessage) {
        bot.sendMessage(TG_CHAT_ID, `
        Ура ура! Тебя пригласили на собес!\n\n
        Сообщение: ${chatMessage.text}
      `);
      }
    }

    if (reply) {
      await VacancyChatService.sendMessage(page, reply.messageToHR);
      await sleep(12000);
    }

    // Сохраняем последнее сообщение

    // eslint-disable-next-line no-param-reassign
    vacancy.lastMessage = lastMessage.text;
    // eslint-disable-next-line no-param-reassign
    vacancy.updatedAt = new Date();

    await vacancy.save();
  }

  private static async parseMessages(page: Page): Promise<ChatMessage[]> {
    await page.waitForSelector('[data-qa^="chatik-chat-message-"]');

    const messageElements = page.locator('[data-qa^="chatik-chat-message-"]');

    const count = await messageElements.count();

    const messages: ChatMessage[] = [];

    for (let i = 0; i < count; i++) {
      const el = messageElements.nth(i);
      const dataQa = await el.getAttribute('data-qa');
      const messageId = dataQa?.replace('chatik-chat-message-', '') ?? '';

      const textEl = el.locator(`[data-qa="chatik-chat-message-${messageId}-text"]`);

      if ((await textEl.count()) === 0) continue;

      const text = await textEl.innerText();
      const isMyMessage = (await el.locator('[class*="message_my"]').count()) > 0;

      const timeEl = el.locator('[data-qa="chat-buble-display-time"]').first();
      const timestamp = (await timeEl.count()) > 0 ? await timeEl.innerText() : '';

      messages.push({
        text: text.trim(),
        author: isMyMessage ? 'me' : 'hr',
        timestamp,
      });
    }

    return messages;
  }

  private static async sendMessage(page: Page, text: string): Promise<void> {
    const input = page.locator('[data-qa="chatik-new-message-text"]');

    await input.fill(text);
    await input.press('Enter');

    console.log('Reply sent:', text);
  }
}
