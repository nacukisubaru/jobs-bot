import { startCommand, stopCommand } from './commands/start-command';
import { uploadCommand } from './commands/upload-command';

import { bot } from './bot';
import { parseVacancyCommand } from './commands/parse-vacancy-command';

export function registerBotCommands() {
  bot.onText(/\/start/, (msg) => {
    startCommand(msg);
  });

  bot.onText(/\/stop/, (msg) => {
    stopCommand(msg);
  });

  bot.onText(/\/upload/, (msg) => uploadCommand(msg));

  bot.on('document', (msg) => {
    if (msg.caption?.startsWith('/upload')) {
      uploadCommand(msg);
    }
  });

  bot.on('message', (msg) => {
    if (msg.text?.includes('hh.ru/vacancy/')) {
      parseVacancyCommand(msg);
    }
  });
}
