import TelegramBot from 'node-telegram-bot-api';

const TOKEN = process.env.TG_TOKEN;

if (!TOKEN) {
  throw new Error('TG_TOKEN не задан в переменных окружения');
}

export const bot = new TelegramBot(TOKEN, { polling: true });