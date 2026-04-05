import type { BrowserContext } from 'playwright';
import TelegramBot from 'node-telegram-bot-api';

import { JobApplicationService } from '../../services/job-application/job-application.service';
import { VacancyService } from '../../services/vacancy/vacancy.service';
import { GPTService } from '../../services/chatgpt/chatgpt.service';

import { bot } from '../bot';

import checkAuth from '../../utils/check-auth';
import { BrowserService } from '../../services/browser/browser.service';

const PROFILE_PATH = './hh-profile';

let interval: NodeJS.Timeout | null = null;

const browser = new BrowserService(PROFILE_PATH);

async function startAutoReplies(chatId: number): Promise<void> {
  if (interval) clearInterval(interval);

  bot.sendMessage(chatId, '🚀 Запускаю автоотклики');

  const isValid = await checkAuth(PROFILE_PATH);

  if (!isValid) {
    clearInterval(interval!);

    interval = null;

    bot.sendMessage(chatId, '⚠️ Авторизация истекла. Загрузите профиль заново');

    return;
  }

  await browser.start();

  const context: BrowserContext = browser.getContext();

  try {
    const jobService = new JobApplicationService(
      context,
      new VacancyService(context),
      new GPTService(),
    );

    await jobService.run();
  } catch (err) {
    console.error('Ошибка при запуске автоклика:', err);

    bot.sendMessage(chatId, `❌ Ошибка при запуске автоклика: ${err}`);
  }
}

export function startCommand(msg: TelegramBot.Message): void {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId, 'Проверяю авторизацию...').then(async () => {
    const isValid = await checkAuth(PROFILE_PATH);

    if (!isValid) {
      bot.sendMessage(
        chatId,
        `❌ Вы не авторизованы. Загрузите профиль по ссылке ${process.env.UPLOAD_PROFILE_SERVER}`,
      );
      return;
    }

    bot.sendMessage(chatId, '✅ Авторизация успешна');

    startAutoReplies(chatId);
  });
}

export async function stopCommand(msg: TelegramBot.Message) {
  const chatId = msg.chat.id;

  if (interval) clearInterval(interval);

  await browser.stop();

  bot.sendMessage(chatId, 'Автоотклики остановлены');
}
