import TelegramBot from "node-telegram-bot-api";

import { startCommand, stopCommand } from "./commands/start-command";

const TOKEN = process.env.TG_TOKEN;

if (!TOKEN) {
  throw new Error("TG_TOKEN не задан в переменных окружения");
}

export const bot = new TelegramBot(TOKEN, { polling: true });

bot.onText(/\/start/, (msg) => {
  startCommand(msg);
});

bot.onText(/\/stop/, (msg) => {
  stopCommand(msg);
});