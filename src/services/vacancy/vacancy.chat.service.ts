import {
  Page,
} from 'playwright';
import { HydratedDocument } from 'mongoose';

// import { addHours, addHours, format } from 'date-fns';
import { GPTService } from '../chatgpt/chatgpt.service';

import { VacancyApplicationModel } from '../vacancy-application/vacancy-applications.model';
import { VacancyApplicationDocument, VacancyApplicationStatus } from '../vacancy-application/vacancy-applications.types';

import { hasContactPattern, sleep } from '../../common/utils/common';
import { logger } from '../../common/logger';
import { TG_CHAT_ID } from '../../common/constants/common';
import { AppException } from '../../common/exceptions';

import { bot } from '../../bot/bot';

import { ChatMessage, IVacancyChatService } from './vacancy.types';
import { BrowserService } from '../browser/browser.service';
// import { appContainer } from '../../app-container';

export class VacancyChatService implements IVacancyChatService {
  constructor(
    private browserService: BrowserService,
    private gptService: GPTService,
  ) {}

  public async processChats(): Promise<void> {
    await this.browserService.start();

    const page: Page = await this.browserService.getContext().newPage();

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

      const chatLinks = await VacancyChatService.collectUnreadChatLinks(page);

      logger.info(`Collected ${chatLinks.length} unread chat links`);

      for (const chatUrl of chatLinks) {
        const openedPage = await this.processChatPage(chatUrl);
        await openedPage.close();
      }
    } catch (err) {
      logger.error('CHAT_SERVICE_ERROR', err);
      throw new AppException('CHAT_SERVICE_ERROR', { cause: err });
    } finally {
      await page.close();
      await this.browserService.stop();
    }
  }

  private static async collectUnreadChatLinks(page: Page, maxCards = 10): Promise<string[]> {
    const chatLinks: string[] = [];
    const allCardsSelector = 'a[data-qa^="chatik-open-chat-"]';
    const unreadSelector = 'a[data-qa^="chatik-open-chat-"]:has([data-qa="chatik-info-badges"])';
    const baseUrl = 'https://hh.ru';

    logger.info('[Chat] Starting scroll to collect unread chats...');

    let prevAllCount = 0;
    let noGrowthRetries = 0;

    const MAX_RETRIES = 10;

    while (true) {
      const allCards = page.locator(allCardsSelector);

      const allCount = await allCards.count();

      if (allCount === 0) break;

      // Собираем бейджики из того что сейчас видно
      const unreadCards = page.locator(unreadSelector);
      const unreadCount = await unreadCards.count();

      for (let i = 0; i < unreadCount; i++) {
        const href = await unreadCards.nth(i).getAttribute('href');
        if (href && !chatLinks.includes(href)) {
          chatLinks.push(href);
          logger.info(`[Chat] Found unread chat: ${href}`);
        }
      }

      // Стоп если прошли maxCards карточек
      if (chatLinks.length >= maxCards) {
        logger.info(`[Chat] Reached max cards limit (${maxCards}), stopping`);
        break;
      }

      await allCards.last().scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);

      const newAllCount = await page.locator(allCardsSelector).count();

      if (newAllCount === prevAllCount) {
        noGrowthRetries++;
        logger.info(`[Chat] No growth, retry ${noGrowthRetries}/${MAX_RETRIES}`);

        if (noGrowthRetries >= MAX_RETRIES) {
          logger.info('[Chat] Reached end of list');
          break;
        }

        await page.waitForTimeout(1500 * noGrowthRetries);
      } else {
        noGrowthRetries = 0;
      }

      prevAllCount = newAllCount;
    }

    return chatLinks.map((href) => (href.startsWith('http') ? href : `${baseUrl}${href}`));
  }

  private async processChatPage(chatUrl: string): Promise<Page> {
    const page: Page = await this.browserService.getContext().newPage();

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

    if (reply) {
      await VacancyChatService.sendMessage(page, reply.messageToHR);
      await sleep(12000);
    }

    const cleanMessage = lastMessage.text.replace(/\s+/g, ' ').trim();

    // eslint-disable-next-line no-param-reassign
    vacancy.lastMessage = cleanMessage;
    // eslint-disable-next-line no-param-reassign
    vacancy.updatedAt = new Date();

    await vacancy.save();

    if (reply.type === 'none') return;

    if (reply.type === 'form') {
      bot.sendMessage(
        TG_CHAT_ID,
        'Заполни форму!\n\n'
        + `Ссылка на вакансию: ${vacancy.link}\n\n`
        + `Сообщение:\n${cleanMessage}`,
      );

      // const time = format(addHours(new Date(), 1), 'HH:mm');
      // appContainer.scheduler.scheduleByTimes([time], 'fill_chat_form_', async () => {
      //   // логика заполнения формы
      // });

      return;
    }

    if (reply.type === 'test-task') {
      bot.sendMessage(
        TG_CHAT_ID,
        'Тебе прислали тестовое задание!\n\n'
        + `Ссылка на вакансию: ${vacancy.link}\n\n`
        + `Сообщение:\n${cleanMessage}`,
      );

      return;
    }

    if (reply.type === 'interview') {
      bot.sendMessage(
        TG_CHAT_ID,
        'Ура ура! Тебя пригласили на собес!\n\n'
        + `Ссылка на вакансию: ${vacancy.link}\n\n`
        + `Контакты: ${reply.contact}\n\n`
        + `Сообщение:\n${cleanMessage}`,
      );

      return;
    }

    const chatMessage = VacancyChatService.findMessageWithContact(messages);

    if (chatMessage) {
      bot.sendMessage(
        TG_CHAT_ID,
        'Ура ура! Тебя пригласили на собес!\n\n'
          + `Сообщение:\n${chatMessage.text.trim()}`,
      );
    }
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
