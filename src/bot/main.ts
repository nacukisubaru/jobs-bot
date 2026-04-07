import { Readable } from 'stream';

import { startCommand, stopCommand } from './commands/start-command';

import { bot } from './bot';

import { VacancyService } from '../services/vacancy/vacancy.service';
import { BrowserService } from '../services/browser/browser.service';
import { GPTService } from '../services/chatgpt/chatgpt.service';

import { BotMessageName } from '../common/constants/bot';

bot.onText(/\/start/, (msg) => {
  startCommand(msg);
});

bot.onText(/\/stop/, (msg) => {
  stopCommand(msg);
});

bot.onText(/\/get-jobs/, async (msg) => {
  const chatId = msg.chat.id;

  const browserService = new BrowserService('./hh-profile');

  await browserService.start();

  const context = browserService.getContext();

  const vacancyService = new VacancyService(context);

  //const gptService = new GPTService();

  try {
    const vacancies = await vacancyService.getVacancies();

    if (!vacancies.length) {
      return await bot.sendMessage(chatId, 'Вакансий не найдено.');
    }

    // const vacancyApplications = await gptService.generateVacancyApplications(vacancies);

    // Формируем текст
    // const text = vacancyApplications.map((v) => `${v.title} - ${v.link}`).join('\n');
    const text = vacancies.map((v) => `${v.title} - ${v.link}`).join('\n');
    // console.log({text});

    // Превращаем в буфер
    const buffer = Buffer.from(text, 'utf-8');
    const stream = Readable.from(buffer);

    // bot.sendMessage(chatId, `Найдено ${vacancyApplications.length} вакансий`);

    await bot.sendDocument(chatId, stream, {}, { filename: 'vacancies.txt' });
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, BotMessageName.GET_JOBS_ERROR);
  } finally {
    browserService.stop();
  }

  return undefined;
});
