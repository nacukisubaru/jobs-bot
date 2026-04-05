import { BrowserContext } from 'playwright';
import {
  IVacancyFetcher, Vacancy,
} from './vacancy.types';

const { LIMIT_FETCH_VACANCIES } = process.env;

export class VacancyService implements IVacancyFetcher {
  constructor(private browserContext: BrowserContext) {
  }

  async getVacancies(onProgress: (progress: number) => void): Promise<Vacancy[]> {
    if (!this.browserContext) {
      throw new Error('Browser context not provided');
    }

    const allVacancies: Vacancy[] = [];
    let pageNumber = 0;
    let hasNextPage = true;
    let processedVacancies = 0;
    let countVacancies = 0;

    while (hasNextPage) {
      const page = await this.browserContext.newPage();
      try {
        const params = new URLSearchParams({
          text: 'react frontend developer',
          area: '113',
          schedule: 'remote',
          page: pageNumber.toString(),
          search_field: 'name',
          order_by: 'publication_time',
        });

        const searchUrl = `https://hh.ru/search/vacancy?${params.toString()}`;

        await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

        const vacanciesHandles = await page.$$('[data-qa="serp-item__title"]');

        if (vacanciesHandles.length === 0) {
          hasNextPage = false;

          break;
        }

        for (const vacancyHandle of vacanciesHandles) {
          if (LIMIT_FETCH_VACANCIES && countVacancies >= parseInt(LIMIT_FETCH_VACANCIES, 10)) {
            return allVacancies;
          }

          try {
            const link = await vacancyHandle.getAttribute('href') || null;

            if (!link) continue;

            const vacancy = await this.parseVacancyDetails(link);

            allVacancies.push(vacancy);

            processedVacancies++;
            countVacancies++;

            onProgress?.(Math.min(100, processedVacancies * 2));

            await new Promise((r) => { setTimeout(r, 5000); });
          } catch {
            continue; // пропускаем отдельные вакансии, если что-то пошло не так
          }
        }

        const nextButton = await page.$('[data-qa="pager-next"]');

        hasNextPage = !!nextButton;
        pageNumber++;

        await new Promise((r) => { setTimeout(r, 5000); });
      } finally {
        await page.close();
      }
    }

    return allVacancies;
  }

  async parseVacancyDetails(url: string): Promise<Vacancy> {
    if (!this.browserContext) {
      throw new Error('Browser context not provided');
    }

    const page = await this.browserContext.newPage();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      const titleHandle = await page.$('[data-qa="vacancy-title"]');
      const companyHandle = await page.$('[data-qa="vacancy-company-name"]');
      const descriptionHandle = await page.$('[data-qa="vacancy-description"]');

      const title = (await titleHandle?.textContent())?.trim() || '';
      const company = (await companyHandle?.textContent())?.trim() || '';

      let description = (await descriptionHandle?.textContent()) || '';

      description = description
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      return {
        link: url,
        title,
        company,
        description,
      };
    } finally {
      await page.close();
    }
  }
}
