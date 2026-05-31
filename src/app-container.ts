import { AUTO_REPLIES_RETRY_DELAY, CRON, MAX_RETRY_JOB_APPLICATION_RUN_COUNT } from './common/constants/common';

import { BrowserService } from './services/browser/browser.service';
import { GPTService } from './services/chatgpt/chatgpt.service';
import { RedisService } from './services/redis/redis.service';
import { ResumeBoostScheduler } from './services/resume/resume-boost.scheduler';
import { BullScheduler } from './services/scheduler/bull-scheduler.service';
import { VacancyApplicationService } from './services/vacancy-application/vacancy-applications.service';
import { VacancyChatService } from './services/vacancy/vacancy.chat.service';
import { VacancyService } from './services/vacancy/vacancy.service';

export class AppContainer {
  readonly browser: BrowserService;

  readonly gptService: GPTService;

  readonly vacancyService: VacancyService;

  readonly vacancyApplicationService: VacancyApplicationService;

  readonly vacancyChatService: VacancyChatService;

  readonly resumeBooster: ResumeBoostScheduler;

  readonly scheduler: BullScheduler;

  constructor() {
    const redisService = new RedisService();
    this.browser = new BrowserService();
    this.gptService = new GPTService();
    this.vacancyService = new VacancyService(this.browser, redisService, this.gptService);
    this.vacancyApplicationService = new VacancyApplicationService(this.browser, this.vacancyService, this.gptService);
    this.vacancyChatService = new VacancyChatService(this.browser, this.gptService);
    this.resumeBooster = new ResumeBoostScheduler(this.browser);

    this.scheduler = new BullScheduler([
      {
        name: 'checkAuth',
        task: () => this.browser.checkAuth(),
        cronExpression: CRON.CHECK_AUTH,
        priority: 1,
      },
      {
        name: 'chatting',
        task: () => this.vacancyChatService.processChats(),
        cronExpression: CRON.CHATTING,
        priority: 2,
      },
      {
        name: 'prepareVacancies',
        task: () => this.vacancyApplicationService.prepareVacancyApplications(),
        cronExpression: CRON.PREPARE_VACANCIES,
        priority: 5,
      },
      {
        name: 'vacanciesReplies',
        task: () => this.vacancyApplicationService.processNewVacancies(),
        cronExpression: CRON.VACANCIES_REPLIES,
        priority: 3,
      },
      {
        name: 'savedVacancies',
        task: () => this.vacancyApplicationService.processSavedVacancies(),
        cronExpression: CRON.SAVED_VACANCIES,
        priority: 4,
      },
    ]);

    const initBooster = async () => {
      try {
        await this.resumeBooster.init();
      } catch (e) {
        console.error('[AppContainer] resumeBooster init failed:', e);
      }
    };

    // initBooster();
  }
}

export const appContainer = new AppContainer();
