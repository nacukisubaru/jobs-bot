import { BrowserContext } from 'playwright';

import {
  FormQuestion,
  IVacancyFetcher, Vacancy,
} from './vacancy.types';

import { HH_URL, PAGE_PARSING_DELAY, TG_CHAT_ID } from '../../common/constants/common';
import { sleep } from '../../common/utils/common';
import { AppException } from '../../common/exceptions';
import { AppErrorName } from '../../common/constants/errors';
import { HttpStatus } from '../../common/constants/https-status';
import { logger } from '../../common/logger';

import { VacancyApplicationModel } from '../vacancy-application/vacancy-applications.model';
import { BotMessageName } from '../../common/constants/bot';
import { bot } from '../../bot/bot';

const { LIMIT_FETCH_VACANCIES } = process.env;

export class VacancyService implements IVacancyFetcher {
  constructor(private browserContext: BrowserContext) {
  }

  async getVacancies(job: string): Promise<Vacancy[]> {
    const allVacancies: Vacancy[] = [];

    let pageNumber = 0;
    let hasNextPage = true;
    let countVacancies = 0;

    while (hasNextPage) {
      const page = await this.browserContext.newPage();

      try {
        const params = new URLSearchParams({
          text: job,
          area: '113',
          schedule: 'remote',
          page: pageNumber.toString(),
          search_field: 'name',
          order_by: 'publication_time',
        });

        const searchUrl = `${HH_URL}/search/vacancy?${params.toString()}`;

        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });

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
          if (!await VacancyApplicationModel.canApplyToVacancy(vacancyLink as string)) continue;

          if (LIMIT_FETCH_VACANCIES && countVacancies >= parseInt(LIMIT_FETCH_VACANCIES, 10)) {
            return allVacancies;
          }

          try {
            const vacancy = await this.parseVacancyDetails(vacancyLink as string);

            allVacancies.push(vacancy);

            countVacancies++;

            await sleep(PAGE_PARSING_DELAY);
          } catch (error) {
            logger.error(AppErrorName.VACANCY_PARSE_ERROR, error);

            continue;
          }
        }

        const nextButton = await page.$('[data-qa="pager-next"]');

        if (!pageNumber && !nextButton) {
          throw new AppException(AppErrorName.VACANCY_MISSING_NEXT_BUTTON, {
            status: HttpStatus.BAD_REQUEST,
            description: `Page ${pageNumber}, URL: ${page.url()}`,
          });
        }

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

    return allVacancies;
  }

  private async parseVacancyDetails(url: string): Promise<Vacancy> {
    const page = await this.browserContext.newPage();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const titleHandle = await page.$('[data-qa="vacancy-title"]');
      const companyHandle = await page.$('[data-qa="vacancy-company-name"]');
      const descriptionHandle = await page.$('[data-qa="vacancy-description"]');

      const title = (await titleHandle?.textContent())?.trim() || '';
      const company = (await companyHandle?.textContent())?.trim() || '';
      const description = (await descriptionHandle?.textContent()) || '';

      const responseButton = page.locator('[data-qa^="vacancy-response-link-top"]').first();

      await responseButton.waitFor({ state: 'visible', timeout: 15000 });
      await responseButton.click();

      let form = null;

      try {
        await page.waitForNavigation({ timeout: 15000 });

        form = await VacancyService.parseForm(page);
      } catch {
        // intentionally empty
      }

      return {
        link: url,
        title,
        company,
        description,
        ...(form && { form }),
      };
    } catch (error) {
      throw new AppException(AppErrorName.VACANCY_PARSE_ERROR, {
        status: HttpStatus.BAD_REQUEST, cause: error,
      });
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
