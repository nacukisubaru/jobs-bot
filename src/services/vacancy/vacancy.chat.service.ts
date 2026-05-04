import {
  BrowserContext, Frame, Locator, Page,
} from 'playwright';
import { HydratedDocument } from 'mongoose';

import { GPTService } from '../chatgpt/chatgpt.service';

import { VacancyApplicationModel } from '../vacancy-application/vacancy-applications.model';
import { VacancyApplicationDocument, VacancyApplicationStatus } from '../vacancy-application/vacancy-applications.types';

import { debugScreenshot, hasContactPattern, sleep } from '../../common/utils/common';
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

  async processAllVacancies(): Promise<void> {
    let hasNextPage = true;

    const page: Page = await this.browserContext.newPage();

    while (hasNextPage) {
      await this.processCurrentPageVacancies(page);

      hasNextPage = await VacancyChatService.goToNextPage(page);
    }
  }

  private async processCurrentPageVacancies(page: Page): Promise<void> {
    try {
      await page.goto('https://hh.ru/applicant/negotiations?filter=all&state=', {
        waitUntil: 'domcontentloaded',
        timeout: 120000,
      });

      await page.waitForSelector('[data-qa="negotiations-item"]');

      const vacancyCards = page.locator('[data-qa="negotiations-item"]');

      const count = await vacancyCards.count();

      let chatFrame;

      for (let i = 0; i < count; i++) {
        const card = vacancyCards.nth(i);

        // Получаем ссылку на вакансию
        const vacancyHref = await card
          .locator('a:has([data-qa="negotiations-item-vacancy"])')
          .getAttribute('href');

        const vacancyUrl = vacancyHref ? `https://hh.ru${vacancyHref.split('?')[0]}` : null;

        if (!vacancyUrl) continue;

        const vacancy = await VacancyApplicationModel.findOne({ link: vacancyUrl });

        if (!vacancy) continue;

        // Обновляем статус вакансии по тегу карточки
        const status = await VacancyChatService.getCardStatus(card);

        if (status) {
          vacancy.status = status;
          vacancy.updatedAt = new Date();

          vacancy.save();
        }

        if (status === VacancyApplicationStatus.REJECTION) continue;

        const chatButton = card.locator('[data-qa="open_chat"]');
        const hasChatButton = await chatButton.count();

        if (hasChatButton === 0) {
          continue;
        }

        await chatButton.click();

        await sleep(20000);

        if (!chatFrame) {
          chatFrame = await VacancyChatService.getChatFrame(page);

          if (!chatFrame) {
            throw new AppException('CHAT_SERVICE_FRAME_NOT_FOUND_ERROR');
          }
        }

        await this.handleChat(chatFrame, vacancy);

        await page.waitForSelector('[data-qa="negotiations-item"]');
      }
    } catch (err) {
      debugScreenshot(page, 'chat-service');

      logger.error('CHAT_SERVICE_ERROR', err);

      throw new AppException('CHAT_SERVICE_ERROR', { cause: err });
    }
  }

  private static findMessageWithContact(messages: ChatMessage[]): ChatMessage | null {
    return messages.slice().reverse().find((m) => m.author === 'hr' && hasContactPattern(m.text)) ?? null;
  }

  private async handleChat(chatFrame: Frame, vacancy: HydratedDocument<VacancyApplicationDocument>): Promise<void> {
    const messages = await VacancyChatService.parseMessages(chatFrame);
    const lastMessage = messages[messages.length - 1] ?? null;

    if (!lastMessage) return;

    // Сравниваем с сохранённым последним сообщением

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
      await VacancyChatService.sendMessage(chatFrame, reply.messageToHR);
    }

    // Сохраняем последнее сообщение

    // eslint-disable-next-line no-param-reassign
    vacancy.lastMessage = lastMessage.text;
    // eslint-disable-next-line no-param-reassign
    vacancy.updatedAt = new Date();

    await vacancy.save();
  }

  private static async parseMessages(chatFrame: Frame): Promise<ChatMessage[]> {
    await chatFrame.waitForSelector('[data-qa^="chatik-chat-message-"]');

    const messageElements = chatFrame.locator('[data-qa^="chatik-chat-message-"]');
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

  private static async getChatFrame(page: Page) {
    const iframeEl = page.locator('.chatik-integration-iframe_loaded');

    const iframeSrc = await iframeEl.getAttribute('src');

    if (!iframeSrc) return null;

    return page.frame({ url: iframeSrc });
  }

  private static async sendMessage(chatFrame: Frame, text: string): Promise<void> {
    const input = chatFrame.locator('[data-qa="chatik-new-message-text"]');

    await input.fill(text);
    await input.press('Enter');

    console.log('Reply sent:', text);
  }

  private static async getCardStatus(card: Locator): Promise<VacancyApplicationStatus | null> {
    const tagEl = card.locator('[data-qa^="negotiations-tag"]');

    if ((await tagEl.count()) === 0) return null;

    const tagText = await tagEl.innerText();

    if (tagText.includes('Отказ')) return VacancyApplicationStatus.REJECTION;
    if (tagText.includes('Собеседование')) return VacancyApplicationStatus.INTERVIEW;

    return null;
  }

  private static async goToNextPage(page: Page): Promise<boolean> {
    const currentPageButton = page.locator('[data-qa*="number-pages"][aria-current="true"]');

    const currentPageExists = await currentPageButton.count();

    if (currentPageExists === 0) return false;

    const currentPageText = await currentPageButton.innerText();
    const currentPage = parseInt(currentPageText.trim(), 10);
    const nextPage = currentPage + 1;

    const nextPageButton = page.locator(`[data-qa*="number-pages-${nextPage}"]`);

    if ((await nextPageButton.count()) === 0) {
      return false;
    }

    await nextPageButton.click();
    await page.waitForSelector('[data-qa="negotiations-item"]');

    return true;
  }
}
