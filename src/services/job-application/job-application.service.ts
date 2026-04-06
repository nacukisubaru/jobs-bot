import { BrowserContext, Page } from 'playwright';

import { IGPTService } from '../chatgpt/chatgpt.types';
import { IVacancyFetcher, Vacancy } from '../vacancy/vacancy.types';
import { IResumeService } from '../resume/resume.types';
import { VacancyApplication } from '../chatgpt/chatgpt.service';

export class JobApplicationService {
  constructor(
    private browserContext: BrowserContext,
    private vacancyFetcher: IVacancyFetcher,
    private gptService: IGPTService,
    private resumeService: IResumeService,
  ) {}

  private async applyToJob(vacancy: VacancyApplication): Promise<void> {
    const { link, letter, resume } = vacancy;

    const page: Page = await this.browserContext.newPage();

    try {
      await page.goto(link, { waitUntil: 'domcontentloaded' });

      const responseButton = await page.waitForSelector(
        '[data-qa="vacancy-response-link-top"]',
        { timeout: 5000 },
      );

      if (!responseButton) {
        console.log('Кнопка отклика не найдена');

        return;
      }

      await responseButton.click();

      const responseModalButton = await page.waitForSelector('[data-qa="vacancy-response-submit-popup"]', { timeout: 5000 });
      const addCoverLetter = page.locator('[data-qa="add-cover-letter"]').first();

      if (await addCoverLetter.count()) {
        await addCoverLetter.click();

        const vacancyLetterInput = page.locator('[data-qa="vacancy-response-popup-form-letter-input"]');

        await vacancyLetterInput.waitFor({ state: 'visible', timeout: 10000 });
        await vacancyLetterInput.fill(letter);
      }

      const button = await page.locator('#RESPONSE_MODAL_FORM_ID [role="button"]');

      await button.click();

      const selectOptionsList = page.locator('[data-qa="magritte-select-option-list"] [role="option"]');
      const count = await selectOptionsList.count();

      for (let i = 0; i < count; i++) {
        const option = selectOptionsList.nth(i);
        const titleElement = option.locator('[data-qa^="resume-title"]');
        const titleText = await titleElement.textContent();

        if (titleText === resume) {
          await option.click();
        }
      }

      // await responseModalButton.click();

      console.log('Отклик отправлен для:', link);
    } catch (err) {
      console.error('Ошибка при попытке отклика:', err);
    } finally {
      await page.close();
    }
  }

  public async run(cb: () => void): Promise<void> {
    try {
      const vacancies: Vacancy[] = await this.vacancyFetcher.getVacancies(cb);

      const resumes = await this.resumeService.getResumes();

      const vacancyApplications: VacancyApplication[] = await this.gptService.generateVacancyApplications(
        vacancies,
        resumes,
      );

      for (const vacancyApplication of vacancyApplications) {
        await this.applyToJob(vacancyApplication);
      }
    } catch (error) {
      console.error('ERROR_IN_RUN', error);
    }
  }
}
