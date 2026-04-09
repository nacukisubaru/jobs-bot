import { BrowserContext, Page } from 'playwright';

import { bot } from '../../bot/bot';

import { IGPTService } from '../chatgpt/chatgpt.types';

import { IVacancyFetcher, Vacancy } from '../vacancy/vacancy.types';

import { IResumeService } from '../resume/resume.types';

import { VacancyApplication, VacancyApplicationStatus } from './vacancy-applications.types';

import { AppErrorName } from '../../common/constants/errors';
import { logger } from '../../common/logger';
import {
  PAGE_PARSING_DELAY, TG_CHAT_ID,
} from '../../common/constants/common';
import { sleep } from '../../common/utils/common';
import { BotMessageName } from '../../common/constants/bot';
import { VacancyApplicationModel } from './vacancy-applications.model';
import { vacancyApplicationStatusMap } from './vacancy-applications.constants';

export class VacancyApplicationService {
  constructor(
    private browserContext: BrowserContext,
    private vacancyFetcher: IVacancyFetcher,
    private gptService: IGPTService,
    private resumeService: IResumeService,
  ) {}

  private async applyToJob(vacancy: VacancyApplication): Promise<void> {
    const { link, letter, resumes } = vacancy;

    const page: Page = await this.browserContext.newPage();

    try {
      await page.goto(link, { waitUntil: 'domcontentloaded' });

      // todo определять ушла ли вакансия в архив, если да то ставим isArchived = true

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

      const responseModalButton = page.locator(
        '[data-qa="vacancy-response-submit-popup"]',
      );

      await responseModalButton.waitFor({ state: 'visible', timeout: 15000 });

      const addCoverLetter = page.locator('[data-qa="add-cover-letter"]').first();

      try {
        await addCoverLetter.waitFor({ state: 'visible' });
      } catch {
        // intentional empty
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

      try {
        const button = await page.locator('#RESPONSE_MODAL_FORM_ID [role="button"]');

        await button.click();
      } catch {
        // intentional empty
      }

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

      await responseModalButton.click();

      const [response] = await Promise.all([
        page.waitForResponse((res) => res.url().includes('vacancy_response')),
        responseModalButton.click(),
      ]);

      if (response.status() === 204) {
        await VacancyApplicationModel.createApplication(vacancy, currentStatus, appliedResume);
      } else {
        logger.warn(`Apply failed with status: ${response.status()}`);
      }
    } catch (err) {
      logger.error(AppErrorName.JOB_APPLICATION_AUTO_APPLY_TO_JOB_ERROR, err);
    } finally {
      await sleep(PAGE_PARSING_DELAY);
      //await sleep(10000);

      await page.close();
    }
  }

  public async prepareVacancyApplications(): Promise<VacancyApplication[]> {
    const resumes = await this.resumeService.getResumes();

    if (!resumes.length) return [];

    const vacancies: Vacancy[] = await this.vacancyFetcher.getVacancies();

    // vacancies[0].link = 'https://hh.ru/vacancy/131182407?query=react&hhtmFrom=vacancy_search_list';

    if (!vacancies.length) {
      logger.warn(new Error(AppErrorName.JOB_APPLICATION_VACANCIES_EMPTY_ERROR));

      bot.sendMessage(TG_CHAT_ID, BotMessageName.VACANCY_PARSING_ERROR);

      return [];
    }

    return this.gptService.generateVacancyApplications(
      vacancies,
      resumes,
    );
  }

  public async applyToSavedVacancies() {
    const vacancyApplications = await VacancyApplicationModel.getActualVacancyApplications();

    this.applyToJobs(vacancyApplications);
  }

  private async applyToJobs(vacancyApplications: VacancyApplication[]) {
    for (const vacancyApplication of vacancyApplications) {
      // if (!await VacancyApplicationModel.canApplyToVacancy(vacancyApplication.link)) continue;

      await this.applyToJob(vacancyApplication);
    }
  }

  public async run(): Promise<void> {
    const vacancyApplications: VacancyApplication[] = await this.prepareVacancyApplications();

    // const vacancyApplications: VacancyApplication[] = [
    //   {
    //     link: 'https://hh.ru/vacancy/131867313?utm_medium=cpc_hh&utm_source=clickmehhru&utm_campaign=1178105&utm_local_campaign=1661822&utm_content=1226353',
    //     title: 'Frontend-разработчик (React.js, Next.js, TypeScript) в клиентские сервисы',
    //     company: 'LatiSoft',
    //     resume: 'Senior frontend react developer',
    //     letter: 'Здравствуйте! Меня заинтересовала вакансия Senior Frontend-разработчика (React) в вашей компании. Имея более 4 лет опыта работы с React, Redux, TypeScript и глубокие знания JavaScript, я уверен, что смогу внести значительный вклад в развитие вашего продукта. В моем резюме вы найдете опыт разработки крупных функциональных модулей, таких как генерация QR-кодов с кастомными настройками на React и SVG, оптимизацию производительности приложений с помощью memoization и redux-undo, а также внедрение AI-инструментов для генерации и стилизации изображений. Я активно использую современные практики разработки — пишу тесты на Jest и React Testing Library, применяю оптимизации рендеринга и архитектурные паттерны. Мой опыт работы с Next.js и постоянное взаимодействие с дизайнерами по UI/UX позволят эффективно создавать адаптивные и кроссбраузерные интерфейсы. Также я практикую менторство и проведение технических интервью в команде. Готов обсуждать архитектурные решения и помогать улучшать качество кода. С уважением, кандидат на позицию.',
    //   },
    // ];

    await this.applyToJobs(vacancyApplications);

    // todo
    // лезть в монго смотреть там есть ли за сегодня отклики, если нет, а попытки запустится были
    // то сообщать об этом в тг, что что-то не рабоает, если есть то один раз в день слать сообщение что все окей
    if (vacancyApplications.length) {
      bot.sendMessage(TG_CHAT_ID, BotMessageName.AUTO_REPLIES_SUCCESS_DONE);
    } else {
      logger.warn(new Error(AppErrorName.JOB_APPLICATION_VACANCIES_NOT_FILTRED_ERROR));

      bot.sendMessage(TG_CHAT_ID, BotMessageName.CHATGPT_FILTER_FAILED);
    }
  }
}
