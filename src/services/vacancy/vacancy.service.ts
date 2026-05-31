import {
  FormQuestion,
  IVacancyFetcher, Vacancy,
} from './vacancy.types';

import {
  HH_URL, PAGE_PARSING_DELAY, TG_CHAT_ID,
} from '../../common/constants/common';
import { sleep } from '../../common/utils/common';
import { AppException } from '../../common/exceptions';
import { AppErrorName } from '../../common/constants/errors';
import { logger } from '../../common/logger';
import { BotMessageName } from '../../common/constants/bot';

import { bot } from '../../bot/bot';

import { RedisService } from '../redis/redis.service';
import { BrowserService } from '../browser/browser.service';

import { clickVacancyApplyButton } from '../../common/utils/vacancy';

import { VacancyApplicationModel } from '../vacancy-application/vacancy-applications.model';
import { GPTService } from '../chatgpt/chatgpt.service';
import { SpecializationSetting } from '../../models/settings/settings.types';
import { format } from '../../common/utils/format';

const { LIMIT_FETCH_VACANCIES } = process.env;

export class VacancyService implements IVacancyFetcher {
  constructor(
    private browserService: BrowserService,
    private redisService: RedisService,
    private gptService: GPTService,
  ) {
  }

  async getVacancies(specialization: SpecializationSetting): Promise<Vacancy[]> {
    await this.browserService.start();

    const allVacancies: Vacancy[] = [];

    let pageNumber = 0;
    let countVacancies = 0;

    let hasNextPage = true;

    while (hasNextPage) {
      const page = await this.browserService.getContext().newPage();

      try {
        const params = new URLSearchParams({
          text: specialization.name,
          area: '113',
          page: pageNumber.toString(),
        });

        const searchUrl = `${HH_URL}/search/vacancy?${params.toString()}`;

        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });

        console.log('screen vacnacies is ready!');

        await page.waitForSelector('[data-qa="serp-item__title"]');

        const vacanciesLinks = await page.$$eval(
          '[data-qa="serp-item__title"]',
          (els) => els.map((el) => el.getAttribute('href')).filter(Boolean),
        );

        if (vacanciesLinks.length === 0) {
          hasNextPage = false;

          break;
        }

        for (const vacancyLink of vacanciesLinks) {
          const limit = specialization?.limitParsingVac ?? (LIMIT_FETCH_VACANCIES
            ? parseInt(LIMIT_FETCH_VACANCIES, 10)
            : null);

          if (limit && countVacancies >= limit) {
            return allVacancies;
          }

          try {
            const vacancy = await this.parseVacancyDetails(vacancyLink as string, specialization);

            if (vacancy) {
              try {
                const existingVacancy = await VacancyApplicationModel.findOne({ link: vacancy.link });

                if (existingVacancy) continue;

                await VacancyApplicationModel.createApplication(vacancy);
              } catch (error) {
                logger.error('VACANCY_APPLICATION_CREATE_IN_DB_ERROR', error);

                continue;
              } finally {
                allVacancies.push(vacancy);

                countVacancies++;
              }
            }

            await sleep(PAGE_PARSING_DELAY);
          } catch (error) {
            logger.error(AppErrorName.VACANCY_PARSE_ERROR, error);

            continue;
          }
        }

        const nextButton = await page.$('[data-qa="pager-next"]');

        hasNextPage = !!nextButton;
        pageNumber++;

        await sleep(PAGE_PARSING_DELAY);
      } catch (error) {
        logger.error(AppErrorName.VACANCY_PARSE_ERROR, error);
      } finally {
        await page.close();
      }
    }

    if (!allVacancies.length) {
      logger.warn(new Error(AppErrorName.JOB_APPLICATION_VACANCIES_EMPTY_ERROR));

      bot.sendMessage(TG_CHAT_ID, BotMessageName.VACANCY_PARSING_ERROR);
    }

    await this.browserService.stop();

    return allVacancies;
  }

  public async parseVacancyDetails(url: string, specialization: SpecializationSetting): Promise<Vacancy | false> {
    const page = await this.browserService.getContext().newPage();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      if (!page.url().includes('hh.ru/vacancy/')) {
        await page.waitForURL('**/vacancy/**', { timeout: 15000 });
      }

      const finalUrl = page.url();

      console.log('final vacancy url:', finalUrl);

      const titleHandle = await page.$('[data-qa="vacancy-title"]');
      const companyHandle = await page.$('[data-qa="vacancy-company-name"]');
      const descriptionHandle = await page.$('[data-qa="vacancy-description"]');

      const title = (await titleHandle?.textContent())?.trim() || '';
      const company = (await companyHandle?.textContent())?.trim() || '';
      const description = (await descriptionHandle?.textContent()) || '';

      if (specialization.prompt) {
        const isValidVacancy = await this.gptService.callGPT<boolean>({
          prompt: format(specialization.prompt, { vacancyTitle: title }),
          field: 'isValidVacancy',
        });

        console.log('isValidVacancy', isValidVacancy);

        if (!isValidVacancy) return false;
      }

      await clickVacancyApplyButton(page);

      console.log('vacancy-description', description);

      let form = null;

      try {
        await page.waitForNavigation({ timeout: 90000 });

        const parsedForm = await VacancyService.parseForm(page);

        console.log('parsedForm', parsedForm);

        form = await this.gptService.generateVacancyFormAnswers(parsedForm);
      } catch {
        // intentionally empty
      }

      const vacancy: Vacancy = {
        link: finalUrl,
        title,
        company,
        description,
        ...(form && { form }),
        resumes: [],
        letter: '',
      };

      vacancy.letter = await this.gptService.generateLetter(vacancy);

      console.log('generated letter', vacancy.letter);

      vacancy.resumes = await this.gptService.generateResumeSelection(vacancy.title, specialization.resumes);

      console.log('generated resumes selection', vacancy.resumes);

      console.log('page url before screenshot:', page.url());
      console.log('page is closed:', page.isClosed());

      return vacancy;
    } catch (error) {
      throw new AppException(AppErrorName.VACANCY_PARSE_ERROR, { cause: error });
    } finally {
      await page.close();
    }
  }

  private static async parseForm(page: any): Promise<FormQuestion[]> {
    const formQuestions: FormQuestion[] = [];

    const tasks = await page.$$('[data-qa^="task-body"]');

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];

      const question = await task.$('[data-qa="task-question"]');
      const questionText = (await question.textContent())?.trim() || '';

      const textarea = await task.$('textarea[type="textarea"]');

      if (textarea) {
        const textareaName = await textarea.getAttribute('name');

        formQuestions.push({
          id: textareaName,
          question: questionText,
        });
      }

      const radioOptions = [];

      const radios = await task.$$('input[type="radio"]');

      for (const radio of radios) {
        const id = await radio.getAttribute('value');

        // Проверяем чтобы не предлаглать к выбору "свой вариант", так как иначе может при заполнении упасть
        if (id === 'open') continue;

        const optionText = (await radio.evaluate((el: any) => (
          el.closest('label')?.innerText
            || el.nextSibling?.textContent
            || ''
        ))).trim();

        radioOptions.push({ id, optionText });
      }

      const checkboxes = await task.$$('input[type="checkbox"]');

      for (const checkbox of checkboxes) {
        const id = await checkbox.getAttribute('value');
        const optionText = (await checkbox.evaluate((el: any) => (
          el.closest('label')?.innerText
            || el.nextSibling?.textContent
            || ''
        ))).trim();

        radioOptions.push({ id, optionText });
      }

      if (radioOptions.length) {
        radioOptions.forEach((options) => {
          formQuestions.push({
            question: questionText,
            options,
          });
        });
      }
    }

    return formQuestions;
  }
}
