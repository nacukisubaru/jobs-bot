import TelegramBot from 'node-telegram-bot-api';

import { bot } from '../bot';

import { BrowserService } from '../../services/browser/browser.service';

import { BotMessageName } from '../../common/constants/bot';
import {
  PROFILE_PATH,
} from '../../common/constants/common';

import { initAutoRepliesSchedulers } from '../tasks/auto-replies-tasks';
import { AsyncScheduler } from '../../services/scheduler/scheduler.service';

const browser = new BrowserService(PROFILE_PATH);

let currentAutoRepliesScheduler: AsyncScheduler | null = null;
let currentApplySavedVacanciesScheduler: AsyncScheduler | null = null;

async function startAutoReplies(): Promise<void> {
  const { autoRepliesScheduler, applySavedVacanciesScheduler, startSchedulers } = initAutoRepliesSchedulers(browser);

  currentAutoRepliesScheduler = autoRepliesScheduler;
  currentApplySavedVacanciesScheduler = applySavedVacanciesScheduler;

  startSchedulers();
}

async function stopAutoReplies(task: AsyncScheduler, chatId: number): Promise<void> {
  if (task.taskIsRunning()) {
    bot.sendMessage(chatId, BotMessageName.AUTO_REPLIES_IS_RUNNING_WAIT);
  }

  task.stop(async () => {
    await browser.stop();

    bot.sendMessage(chatId, BotMessageName.AUTO_REPLIES_IS_STOPPED);
  });
}

export async function startCommand(msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  console.log('Start command received');

  await browser.start();

  bot.sendMessage(chatId, BotMessageName.CHECKING_AUTORIZE).then(async () => {
    const isAuth = await browser.isAuth();

    if (!isAuth) {
      bot.sendMessage(
        chatId,
        `${BotMessageName.AUTHORIZATION_ERROR} ${process.env.UPLOAD_PROFILE_SERVER}`,
      );

      return;
    }

    bot.sendMessage(chatId, BotMessageName.AUTHORIZATION_SUCCESS);

    startAutoReplies();
  });
}

export async function stopCommand(msg: TelegramBot.Message) {
  const chatId = msg.chat.id;

  if (currentApplySavedVacanciesScheduler) {
    stopAutoReplies(currentApplySavedVacanciesScheduler, chatId);
  }

  if (currentAutoRepliesScheduler) {
    stopAutoReplies(currentAutoRepliesScheduler, chatId);
  }
}
