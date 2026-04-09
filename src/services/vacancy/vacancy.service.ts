import { BrowserContext } from 'playwright';

import {
  IVacancyFetcher, Vacancy,
} from './vacancy.types';

import { HH_URL, PAGE_PARSING_DELAY } from '../../common/constants/common';
import { sleep } from '../../common/utils/common';
import { AppException } from '../../common/exceptions';
import { AppErrorName } from '../../common/constants/errors';
import { HttpStatus } from '../../common/constants/https-status';
import { logger } from '../../common/logger';

const { LIMIT_FETCH_VACANCIES } = process.env;

export class VacancyService implements IVacancyFetcher {
  constructor(private browserContext: BrowserContext) {
  }

  async getVacancies(): Promise<Vacancy[]> {
    const allVacancies: Vacancy[] = [];

    let pageNumber = 0;
    let hasNextPage = true;
    let countVacancies = 0;

    while (hasNextPage) {
      const page = await this.browserContext.newPage();

      try {
        const params = new URLSearchParams({
          text: 'react',
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

    return allVacancies;
  }

  async parseVacancyDetails(url: string): Promise<Vacancy> {
    const page = await this.browserContext.newPage();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const titleHandle = await page.$('[data-qa="vacancy-title"]');
      const companyHandle = await page.$('[data-qa="vacancy-company-name"]');
      const descriptionHandle = await page.$('[data-qa="vacancy-description"]');

      const title = (await titleHandle?.textContent())?.trim() || '';
      const company = (await companyHandle?.textContent())?.trim() || '';
      const description = (await descriptionHandle?.textContent()) || '';

      return {
        link: url,
        title,
        company,
        description,
      };
    } catch (error) {
      throw new AppException(AppErrorName.VACANCY_PARSE_ERROR, {
        status: HttpStatus.BAD_REQUEST, cause: error,
      });
    } finally {
      await page.close();
    }
  }
}
