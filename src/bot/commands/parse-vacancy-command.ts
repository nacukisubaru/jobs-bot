import TelegramBot from 'node-telegram-bot-api';

import { addMinutes, format } from 'date-fns';

import { bot } from '../bot';

import { appContainer } from '../../app-container';

import { VacancyApplicationModel } from '../../services/vacancy-application/vacancy-applications.model';

import { SettingsModel } from '../../models/settings/settings.model';

export async function parseVacancyCommand(msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  const url = msg.text?.trim();

  if (!url?.includes('hh.ru/vacancy/')) return;

  await bot.sendMessage(chatId, '🔄 Вакансия добавлена в очередь');

  const parseVacancy = async () => {
    try {
      const careerSettings = await SettingsModel.getByKey('career-preferences');

      const specializations = careerSettings?.value?.specializations ?? [];
      const specialization = specializations[0];

      await appContainer.browser.start();

      const vacancy = await appContainer.vacancyService.parseVacancyDetails(url, specialization);

      const existing = await VacancyApplicationModel.findOne({ link: vacancy.link });

      if (existing) {
        await bot.sendMessage(chatId, '⚠️ Вакансия уже есть в базе');

        return;
      }

      await VacancyApplicationModel.createApplication(vacancy);
      await bot.sendMessage(chatId, `✅ Добавлено: ${vacancy.title} — ${vacancy.company}`);
    } catch (e) {
      await bot.sendMessage(chatId, '❌ Ошибка парсинга');
    } finally {
      await appContainer.browser.stop();
    }
  };

  const time = format(addMinutes(new Date(), 5).toISOString(), 'HH:mm');

  appContainer.scheduler.scheduleByTimes([time], 'parseVacancy', parseVacancy);
}
