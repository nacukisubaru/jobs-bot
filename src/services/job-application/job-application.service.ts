import { BrowserContext, Page } from 'playwright';

import { bot } from '../../bot/bot';

import { VacancyApplication } from '../chatgpt/chatgpt.service';
import { IGPTService } from '../chatgpt/chatgpt.types';

import { IVacancyFetcher, Vacancy } from '../vacancy/vacancy.types';

import { IResumeService } from '../resume/resume.types';

import { AppErrorName } from '../../common/constants/errors';
import { logger } from '../../common/logger';
import {
  PAGE_PARSING_DELAY, TG_CHAT_ID,
} from '../../common/constants/common';
import { sleep } from '../../common/utils/common';
import { AppException } from '../../common/exceptions';
import { HttpStatus } from '../../common/constants/https-status';
import { BotMessageName } from '../../common/constants/bot';

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

      const responseButton = page.locator('[data-qa^="vacancy-response-link-top"]').first();

      await responseButton.waitFor({ state: 'visible', timeout: 15000 });
      await responseButton.click();

      const responseModalButton = page.locator(
        '[data-qa="vacancy-response-submit-popup"]',
      );

      await responseModalButton.waitFor({ state: 'visible', timeout: 15000 });

      const addCoverLetter = page.locator('[data-qa="add-cover-letter"]').first();

      await addCoverLetter.waitFor({ state: 'visible' });

      const addCoverLetterBtn = await addCoverLetter.count();

      if (addCoverLetterBtn) {
        await addCoverLetter.click();
      }

      const vacancyLetterInput = page.locator('[data-qa="vacancy-response-popup-form-letter-input"]');

      await vacancyLetterInput.waitFor({ state: 'visible' });
      await vacancyLetterInput.waitFor({ state: 'attached' });

      await vacancyLetterInput.click({ force: true });
      await vacancyLetterInput.fill(letter);

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
    } catch (err) {
      console.error({ err });
      // playwrigth срет ошибками типа такими waiting for locator('[data-qa="add-cover-letter"]').first() to be visible
      // и ему это в порядке вещей при этом все отрабатывает, если здесь жестко обрывать, то никогда работать не будет
      // надо подумать над этим, а еще подумать на тем что при
      // выкидывании ошибок у меня пишет просто originalerror error
      // а ошибку яне вижу
      // throw new AppException(
      //   AppErrorName.JOB_APPLICATION_AUTO_APPLY_TO_JOB_ERROR,
      //   { cause: err },
      // );
    } finally {
      await sleep(5000);

      await page.close();
    }
  }

  public async run(): Promise<void> {
    // const resumes = await this.resumeService.getResumes();

    // if (!resumes.length) {
    //   logger.warn(new Error(AppErrorName.JOB_APPLICATION_RESUMES_EMPTY_ERROR));

    //   bot.sendMessage(TG_CHAT_ID, BotMessageName.RESUMES_PARSING_ERROR);

    //   return;
    // }

    const vacancies: Vacancy[] = await this.vacancyFetcher.getVacancies();

    if (!vacancies.length) {
      logger.warn(new Error(AppErrorName.JOB_APPLICATION_VACANCIES_EMPTY_ERROR));

      bot.sendMessage(TG_CHAT_ID, BotMessageName.VACANCY_PARSING_ERROR);

      return;
    }

    // const vacancyApplications: VacancyApplication[] = await this.gptService.generateVacancyApplications(
    //   vacancies,
    //   resumes,
    // );

    const vacancyApplications = [
      {
        link: 'https://hh.ru/vacancy/131909196?query=react+frontend+developer&hhtmFrom=vacancy_search_list',
        title: 'Senior Frontend-разработчик (React)',
        company: 'ИП Кудря Ольга Сергеевна',
        resume: 'Senior frontend react developer',
        letter: 'Здравствуйте! Меня заинтересовала вакансия Senior Frontend-разработчика (React) в вашей компании. Имея более 4 лет опыта работы с React, Redux, TypeScript и глубокие знания JavaScript, я уверен, что смогу внести значительный вклад в развитие вашего продукта. В моем резюме вы найдете опыт разработки крупных функциональных модулей, таких как генерация QR-кодов с кастомными настройками на React и SVG, оптимизацию производительности приложений с помощью memoization и redux-undo, а также внедрение AI-инструментов для генерации и стилизации изображений. Я активно использую современные практики разработки — пишу тесты на Jest и React Testing Library, применяю оптимизации рендеринга и архитектурные паттерны. Мой опыт работы с Next.js и постоянное взаимодействие с дизайнерами по UI/UX позволят эффективно создавать адаптивные и кроссбраузерные интерфейсы. Также я практикую менторство и проведение технических интервью в команде. Готов обсуждать архитектурные решения и помогать улучшать качество кода. С уважением, кандидат на позицию.',
      },
      {
        link: 'https://hh.ru/vacancy/131123116?query=react+frontend+developer&hhtmFrom=vacancy_search_list',
        title: 'Senior Frontend-разработчик (React)',
        company: 'ИП Кудря Ольга Сергеевна',
        resume: 'Senior frontend react developer',
        letter: 'Здравствуйте! Меня заинтересовала вакансия Senior Frontend-разработчика (React) в вашей компании. Имея более 4 лет опыта работы с React, Redux, TypeScript и глубокие знания JavaScript, я уверен, что смогу внести значительный вклад в развитие вашего продукта. В моем резюме вы найдете опыт разработки крупных функциональных модулей, таких как генерация QR-кодов с кастомными настройками на React и SVG, оптимизацию производительности приложений с помощью memoization и redux-undo, а также внедрение AI-инструментов для генерации и стилизации изображений. Я активно использую современные практики разработки — пишу тесты на Jest и React Testing Library, применяю оптимизации рендеринга и архитектурные паттерны. Мой опыт работы с Next.js и постоянное взаимодействие с дизайнерами по UI/UX позволят эффективно создавать адаптивные и кроссбраузерные интерфейсы. Также я практикую менторство и проведение технических интервью в команде. Готов обсуждать архитектурные решения и помогать улучшать качество кода. С уважением, кандидат на позицию.',
      },
    ];

    for (const vacancyApplication of vacancyApplications) {
      await this.applyToJob(vacancyApplication);
    }

    if (vacancyApplications.length) {
      bot.sendMessage(TG_CHAT_ID, BotMessageName.AUTO_REPLIES_SUCCESS_DONE);
    } else {
      logger.warn(new Error(AppErrorName.JOB_APPLICATION_VACANCIES_NOT_FILTRED_ERROR));

      bot.sendMessage(TG_CHAT_ID, BotMessageName.CHATGPT_FILTER_FAILED);
    }
  }
}
