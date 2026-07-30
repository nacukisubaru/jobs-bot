import { CRON } from './common/constants/common';
import { BrowserService } from './services/browser/browser.service';
import { AIService } from './services/ai/ai.service';
import { RedisService } from './services/redis/redis.service';
import { ResumeBoostScheduler } from './services/resume/resume-boost.scheduler';
import { BullScheduler } from './services/scheduler/bull-scheduler.service';
import { VacancyApplicationService } from './services/vacancy-application/vacancy-applications.service';
import { VacancyChatService } from './services/vacancy/vacancy.chat.service';
import { VacancyService } from './services/vacancy/vacancy.service';

import { SettingsModel } from './models/settings/settings.model';
import { SpecializationSetting } from './models/settings/settings.types';

export class AppContainer {
  readonly browser: BrowserService;

  readonly aiService: AIService;

  readonly vacancyService: VacancyService;

  readonly vacancyApplicationService: VacancyApplicationService;

  readonly vacancyChatService: VacancyChatService;

  readonly resumeBooster: ResumeBoostScheduler;

  public scheduler: BullScheduler = null as any;

  constructor() {
    const redisService = new RedisService();

    this.browser = new BrowserService();
    this.aiService = new AIService();
    this.vacancyService = new VacancyService(this.browser, redisService, this.aiService);
    this.vacancyApplicationService = new VacancyApplicationService(this.browser, this.vacancyService, this.aiService);
    this.vacancyChatService = new VacancyChatService(this.browser, this.aiService);
    this.resumeBooster = new ResumeBoostScheduler(this.browser);
  }

  async init(runOnInit = false): Promise<void> {
    const tasksTimers = await SettingsModel.getByKey('tasks-timers');
    const careerSettings = await SettingsModel.getByKey('career-preferences');

    const timers = tasksTimers?.value ?? {};
    const specializations = careerSettings?.value?.specializations ?? [];

    this.scheduler = await BullScheduler.create([
      {
        name: 'checkAuth',
        task: () => this.browser.checkAuth(),
        cronExpression: timers.checkAuth || CRON.CHECK_AUTH,
        priority: 1,
      },
      {
        name: 'chatting',
        task: () => this.vacancyChatService.processChats(),
        cronExpression: timers.chatting || CRON.CHATTING,
        priority: 2,
      },
      {
        name: 'vacanciesReplies',
        task: () => this.vacancyApplicationService.processNewVacancies(),
        cronExpression: timers.vacanciesReplies || CRON.VACANCIES_REPLIES,
        priority: 3,
      },
      {
        name: 'savedVacancies',
        task: () => this.vacancyApplicationService.processSavedVacancies(),
        cronExpression: timers.savedVacancies || CRON.SAVED_VACANCIES,
        priority: 4,
      },
      ...specializations
        .filter((s: SpecializationSetting) => s.cronTime && s.name)
        .map((s: SpecializationSetting) => ({
          name: `prepareVacancies_${s.id}`,
          task: () => this.vacancyApplicationService.prepareVacancyApplications(s),
          cronExpression: s.cronTime,
          priority: 5,
        })),
    ]);

    await this.scheduler.start(runOnInit);
  }
}

export const appContainer = new AppContainer();
