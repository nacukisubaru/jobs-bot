import { BrowserContext, Locator, Page } from 'playwright';
import { FormsAnswers, IGPTService } from '../chatgpt/chatgpt.types';

import { IVacancyFetcher } from '../vacancy/vacancy.types';

import { SubmitApplyArgs, VacancyApplication, VacancyApplicationStatus } from './vacancy-applications.types';

import { AppErrorName } from '../../common/constants/errors';
import { logger } from '../../common/logger';
import {
  PAGE_PARSING_DELAY,
} from '../../common/constants/common';
import { debugScreenshot, sleep, truncateText } from '../../common/utils/common';
import { AppException } from '../../common/exceptions';

import { VacancyApplicationModel } from './vacancy-applications.model';
import { vacancyApplicationStatusMap } from './vacancy-applications.constants';

import { SettingsModel } from '../../models/settings/settings.model';

import { ResumeModel } from '../resume/resume.model';

export class VacancyApplicationService {
  constructor(
    private browserContext: BrowserContext,
    private vacancyFetcher: IVacancyFetcher,
    private gptService: IGPTService,
  ) {}

  public async processNewVacancies(): Promise<void> {
    const careerSettings = await SettingsModel.getByKey('career-preferences');

    const { specializations } = careerSettings.value;

    for (const specialization of specializations) {
      const fetchedVacancies = await this.vacancyFetcher.getVacancies(specialization.name);

      const resumes = await ResumeModel.getResumesBySpec(specialization.id);

      if (!fetchedVacancies.length) {
        throw new AppException(AppErrorName.VACANCY_APPLICATIONS_FETCH_ERROR);
      }

      const vacanciesMap = new Map(fetchedVacancies.map((vacancy) => [
        vacancy.link,
        { ...vacancy, description: truncateText(vacancy?.description || '') },
      ]));

      const keywords = resumes[0]?.keywords?.join(',') || '';

      const generatedApplications = await this.gptService.generateVacancyApplications(
        [...vacanciesMap.values()],
        specialization,
        keywords,
      );

      await this.applyToJobs(generatedApplications.flatMap((application) => {
        const vacancyData = vacanciesMap.get(application.link);

        if (!vacancyData) return [];

        return [{
          ...vacancyData,
          ...application,
          resumes: resumes.map((resume) => resume.profession),
        }];
      }) as VacancyApplication[]); // todo поправить типизацию

      await this.vacancyFetcher.markVacancySeen([...vacanciesMap.keys()]);
    }
  }

  public async processSavedVacancies() {
    const vacancyApplications = await VacancyApplicationModel.getActualVacancyApplications();

    this.applyToJobs(vacancyApplications);
  }

  private async applyToJobs(vacancyApplications: VacancyApplication[]) {
    for (const vacancyApplication of vacancyApplications) {
      if (!await VacancyApplicationModel.isAlreadyApplied(vacancyApplication.link)) {
        await this.applyToJob(vacancyApplication);
      }
    }
  }

  private async applyToJob(vacancy: VacancyApplication): Promise<void> {
    const { link, letter, resumes } = vacancy;

    const page: Page = await this.browserContext.newPage();

    try {
      await page.goto(link, { waitUntil: 'domcontentloaded' });

      let currentStatus: VacancyApplicationStatus = VacancyApplicationStatus.NONE;

      for (const [text, status] of vacancyApplicationStatusMap) {
        const locator = page.getByText(text);

        if (await locator.count() > 0) {
          currentStatus = status;
        }
      }

      const responseButton = page.locator('[data-qa^="vacancy-response-link-top"]').first();

      await responseButton.waitFor({ state: 'visible', timeout: 15000 });
      await responseButton.click();

      let redirected = false;

      try {
        await page.waitForNavigation({ timeout: 15000 });
        redirected = true;
      } catch {
        redirected = false;
      }

      if (redirected && vacancy.form) {
        await VacancyApplicationService.fillForm(page, resumes, vacancy, currentStatus);

        return;
      }

      const addCoverLetter = page.locator('[data-qa="add-cover-letter"]').first();

      await VacancyApplicationService.fillVacancyLetter(page, addCoverLetter, letter);

      try {
        const button = await page.locator('#RESPONSE_MODAL_FORM_ID [role="button"]');

        await button.click();
      } catch {
        // intentional empty
      }

      const appliedResume = await VacancyApplicationService.selectResume(page, resumes);

      await VacancyApplicationService.submitApply({
        page, vacancy, currentStatus, appliedResume,
      });
    } catch (err) {
      await debugScreenshot(page, 'apply-to-job');

      logger.error(AppErrorName.JOB_APPLICATION_AUTO_APPLY_TO_JOB_ERROR, err);
    } finally {
      await sleep(PAGE_PARSING_DELAY);

      await page.close();
    }
  }

  private static async selectResume(page: Page, resumes: string[]): Promise<string> {
    const selectOptionsList = page.locator('[data-qa="magritte-select-option-list"] [role="option"]');

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

    await page.keyboard.press('Escape');

    return appliedResume;
  }

  private static async fillVacancyLetter(page: Page, addCoverLetter: Locator, letter: string) {
    try {
      await addCoverLetter.waitFor({ state: 'visible' });
    } catch {
      // intentionally empty
    }

    const addCoverLetterBtn = await addCoverLetter.count();

    if (addCoverLetterBtn) {
      await addCoverLetter.click();
    }

    const vacancyLetterInput = page.locator('[data-qa="vacancy-response-popup-form-letter-input"]');

    await vacancyLetterInput.waitFor({ state: 'visible' });
    await vacancyLetterInput.waitFor({ state: 'attached' });

    await vacancyLetterInput.click({ force: true });
    await vacancyLetterInput.fill(letter);
  }

  private static async fillForm(
    page: Page,
    resumes: string[],
    vacancy: VacancyApplication,
    currentStatus: VacancyApplicationStatus,
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
      page, vacancy, currentStatus, appliedResume,
    });
  }

  private static async submitApply({
    page, vacancy, currentStatus, appliedResume,
  }: SubmitApplyArgs): Promise<void> {
    const responseModalButton = page.locator(
      '[data-qa="vacancy-response-submit-popup"]',
    );

    await responseModalButton.waitFor({ state: 'visible', timeout: 15000 });

    const [response] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('vacancy_response')),
      responseModalButton.click(),
    ]);

    const status = response.status();

    if (status === 204 || status === 200) {
      await VacancyApplicationModel.createApplication(vacancy, currentStatus, appliedResume);
    } else {
      logger.warn(`Apply failed with status: ${status}`);
    }
  }
}
