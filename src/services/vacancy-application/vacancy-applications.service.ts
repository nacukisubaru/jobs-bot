import { Locator, Page } from 'playwright';
import { FormsAnswers, IGPTService } from '../chatgpt/chatgpt.types';

import { IVacancyFetcher } from '../vacancy/vacancy.types';

import { SubmitApplyArgs, VacancyApplication } from './vacancy-applications.types';

import { AppErrorName } from '../../common/constants/errors';
import { logger } from '../../common/logger';
import {
  PAGE_PARSING_DELAY,
} from '../../common/constants/common';
import { sleep, truncateText } from '../../common/utils/common';
import { AppException } from '../../common/exceptions';

import { VacancyApplicationModel } from './vacancy-applications.model';

import { SettingsModel } from '../../models/settings/settings.model';

import { BrowserService } from '../browser/browser.service';

export class VacancyApplicationService {
  constructor(
    private browser: BrowserService,
    private vacancyFetcher: IVacancyFetcher,
    private gptService: IGPTService,
  ) {}

  public async processNewVacancies(): Promise<void> {
    const vacancyApplications = await VacancyApplicationModel.getVacancyApplications();

    if (!vacancyApplications.length) return;

    await this.browser.start();

    for (const vacancyApplication of vacancyApplications) {
      await this.applyToJob(vacancyApplication);
    }

    await this.browser.stop();
  }

  public async processSavedVacancies() {
    const vacancyApplications = await VacancyApplicationModel.getActualVacancyApplications();

    await this.browser.start();

    for (const vacancyApplication of vacancyApplications) {
      await this.applyToJob(vacancyApplication);
    }

    await this.browser.stop();
  }

  public async prepareVacancyApplications(): Promise<void> {
    const careerSettings = await SettingsModel.getByKey('career-preferences');

    const { specializations, keywords } = careerSettings.value;

    for (const specialization of specializations) {
      const fetchedVacancies = await this.vacancyFetcher.getVacancies(specialization.name);

      if (!fetchedVacancies.length) {
        throw new AppException(AppErrorName.VACANCY_APPLICATIONS_FETCH_ERROR);
      }

      const vacanciesMap = new Map(fetchedVacancies.map((vacancy) => [
        vacancy.link,
        { ...vacancy, description: truncateText(vacancy?.description || '') },
      ]));

      const generatedApplications = await this.gptService.generateVacancyApplications(
        [...vacanciesMap.values()],
        specialization,
        keywords?.join(',') || '',
      );

      console.dir(generatedApplications, { depth: null, colors: true });

      const vacancyApplications = generatedApplications.flatMap((application) => {
        const vacancyData = vacanciesMap.get(application.link);

        if (!vacancyData) return [];

        return [{
          ...vacancyData,
          ...application,
          resumes: specialization.resumes,
        }];
      }) as VacancyApplication[];

      try {
        await VacancyApplicationModel.createApplications(vacancyApplications);
      } catch (error) {
        logger.error('VACANCY_APPLICATION_CREATE_IN_DB_ERROR', error);

        continue;
      }

      await this.vacancyFetcher.markVacancySeen([...vacanciesMap.keys()]);
    }
  }

  private async applyToJob(vacancy: VacancyApplication): Promise<void> {
    const { link, letter, resumes } = vacancy;

    const page: Page = await this.browser.getContext().newPage();

    try {
      await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 120000 });

      console.log('page', link);

      const archiveText = page.locator('text="Вакансия в архиве"');

      if (await archiveText.count() > 0) {
        await VacancyApplicationModel.updateOne(
          { link },
          {
            $set: {
              isArchived: true,
              updatedAt: new Date(),
            },
          },
        );

        return;
      }

      const clickOnResponseButton = async (responseButton: Locator) => {
        await responseButton.waitFor({ state: 'visible', timeout: 90000 });

        await page.waitForTimeout(2000);

        await responseButton.click({ force: true });
      };

      try {
        const responseButton = page.locator('[data-qa^="vacancy-response-link-top"]').first();

        await clickOnResponseButton(responseButton);
      } catch {
        try {
          const responseButton = page.locator('[data-qa="vacancy-response-link-top-again"]');

          await clickOnResponseButton(responseButton);
        } catch {
          throw new AppException('VACANCY_APPLICATION_RESP_BTN_NOT_FOUND');
        }
      }

      let redirected = false;

      try {
        await page.waitForNavigation({ timeout: 15000 });
        redirected = true;
      } catch {
        redirected = false;
      }

      if (redirected && vacancy.form) {
        await VacancyApplicationService.fillForm(page, resumes, vacancy);

        return;
      }

      const addCoverLetter = page.locator('[data-qa="add-cover-letter"]').first();

      await VacancyApplicationService.fillVacancyLetter(page, addCoverLetter, letter);

      console.log('filled letter', link);

      try {
        const button = await page.locator('#RESPONSE_MODAL_FORM_ID [role="button"]');

        await button.click();
      } catch {
        // intentional empty
      }

      const appliedResume = await VacancyApplicationService.selectResume(page, resumes);

      await VacancyApplicationService.submitApply({
        page, vacancy, appliedResume,
      });

      console.log('replied finaly', link);
    } catch (err) {
      logger.error(AppErrorName.JOB_APPLICATION_AUTO_APPLY_TO_JOB_ERROR, err);
    } finally {
      await sleep(PAGE_PARSING_DELAY);

      await page.close();
    }
  }

  private static async selectResume(page: Page, resumes: string[]): Promise<string> {
    const selectOptionsList = page.locator('[data-qa="magritte-select-option-list"] [role="option"]');

    await selectOptionsList.first().waitFor({ state: 'visible', timeout: 10000 });

    const count = await selectOptionsList.count();
    let appliedResume = '';

    for (let i = 0; i < count; i++) {
      const option = selectOptionsList.nth(i);
      const titleElement = option.locator('[data-qa^="resume-title"]');
      const titleText = await titleElement.textContent();

      if (titleText && resumes.includes(titleText)) {
        appliedResume = titleText;
        await option.click();
        break;
      }
    }

    if (count > 0) {
      await page.keyboard.press('Escape');
    }

    return appliedResume;
  }

  private static async fillVacancyLetter(page: Page, addCoverLetter: Locator, letter: string) {
    const vacancyLetterInput = page.locator('[data-qa="vacancy-response-popup-form-letter-input"]');

    const fillLetter = async () => {
      await vacancyLetterInput.waitFor({ state: 'visible', timeout: 90000 });
      await vacancyLetterInput.click({ force: true });
      await vacancyLetterInput.fill(letter);

      console.log('letter filled!');
    };

    try {
      await fillLetter();

      return;
    } catch {
      // intentionaly empty
    }

    try {
      await addCoverLetter.waitFor({ state: 'visible', timeout: 90000 });
      await addCoverLetter.click();

      await fillLetter();
    } catch {
      console.warn('cover letter input not found, skipping');
    }
  }

  private static async fillForm(
    page: Page,
    resumes: string[],
    vacancy: VacancyApplication,
  ) {
    const { inputs, options } = vacancy.form as FormsAnswers;

    for (const optionId of options) {
      const optionLocator = page.locator(`input[value="${optionId}"]`);

      await optionLocator.waitFor({ state: 'visible' });
      await optionLocator.click();
    }

    for (const input of inputs) {
      const { id, value } = input;

      try {
        const inputLocator = page.locator(`textarea[name="${id}"]`);

        await inputLocator.waitFor({ state: 'visible' });
        await inputLocator.fill(value);
      } catch (error) {
        logger.warn(`INPUT_NOT_APPEREAD_IN_FORM element=${id} vacancy=${vacancy.link}`);

        continue;
      }
    }

    const resumeTitle = page.locator('[data-qa="resume-title"]');

    await resumeTitle.click();

    const appliedResume = await VacancyApplicationService.selectResume(page, resumes);

    const vacancyResponseLetterToggle = page.locator('[data-qa="vacancy-response-letter-toggle"]');

    await VacancyApplicationService.fillVacancyLetter(page, vacancyResponseLetterToggle, vacancy.letter);

    await VacancyApplicationService.submitApply({
      page, vacancy, appliedResume,
    });
  }

  private static async submitApply({
    page, vacancy, appliedResume,
  }: SubmitApplyArgs): Promise<void> {
    const responseModalButton = page.locator(
      '[data-qa="vacancy-response-submit-popup"]',
    );

    await responseModalButton.waitFor({ state: 'visible', timeout: 90000 });

    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('vacancy_response'), { timeout: 90000 }),
      responseModalButton.click(),
    ]);

    const status = response.status();

    if (status === 204 || status === 200) {
      await VacancyApplicationModel.updateApplication(vacancy, appliedResume);
    } else {
      logger.warn(`Apply failed with status: ${status}`);
    }
  }
}
