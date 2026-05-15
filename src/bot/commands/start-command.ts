import TelegramBot from 'node-telegram-bot-api';

import { bot } from '../bot';

import { BotMessageName } from '../../common/constants/bot';

import { appContainer } from '../../app-container';

export async function startCommand(msg: TelegramBot.Message) {
  const chatId = msg.chat.id;

  if (appContainer.scheduler.isRunning()) {
    bot.sendMessage(chatId, 'Бот уже запущен');

    return;
  }

  await appContainer.scheduler.start();
}

export async function stopCommand(msg: TelegramBot.Message) {
  const chatId = msg.chat.id;

  await appContainer.scheduler.stop();
  await appContainer.browser.stop();

  await bot.sendMessage(chatId, BotMessageName.AUTO_REPLIES_IS_STOPPED);
}
