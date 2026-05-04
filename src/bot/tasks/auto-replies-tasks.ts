import { VacancyApplicationService } from '../../services/vacancy-application/vacancy-applications.service';
import { BrowserService } from '../../services/browser/browser.service';
import { ResumeService } from '../../services/resume/resume.service';
import { GPTService } from '../../services/chatgpt/chatgpt.service';
import { redisService } from '../../services/redis/redis.service';

import { VacancyService } from '../../services/vacancy/vacancy.service';
import { VacancyChatService } from '../../services/vacancy/vacancy.chat.service';

import { AsyncScheduler } from '../../services/scheduler/scheduler.service';
import { createScheduledTask } from '../../services/scheduler/scheduler-factory';

import {
  AUTO_REPLIES_RETRY_REPEAT_DELAY,
  AUTO_REPLIES_RETRY_DELAY, MAX_RETRY_JOB_APPLICATION_RUN_COUNT,
  CRON,
} from '../../common/constants/common';
import { AppErrorName } from '../../common/constants/errors';
import { BotMessageName } from '../../common/constants/bot';

let autoRepliesScheduler: AsyncScheduler;
let applySavedVacanciesScheduler: AsyncScheduler;
let autoCreateResumesScheduler: AsyncScheduler;
let autoChattingByVacancies: AsyncScheduler;

export function initAutoRepliesSchedulers(browser: BrowserService) {
  const context = browser.getContext();

  const gptService = new GPTService();
  const vacancyService = new VacancyService(context, redisService);
  const resumeService = new ResumeService(context, gptService);
  const vacancyApplicationService = new VacancyApplicationService(context, vacancyService, gptService);
  const vacancyChatService = new VacancyChatService(context, gptService);

  const vacanciesReplies = () => vacancyApplicationService.processNewVacancies();
  const savedVacancies = () => vacancyApplicationService.processSavedVacancies();
  const createResumes = () => resumeService.createResumes();
  const chattingByVacancies = () => vacancyChatService.processAllVacancies();

  autoRepliesScheduler = createScheduledTask(
    vacanciesReplies,
    CRON.EVERY_HOUR,
    AUTO_REPLIES_RETRY_DELAY,
    MAX_RETRY_JOB_APPLICATION_RUN_COUNT,
    AppErrorName.JOB_APPLICATION_AUTO_APPLY_FAILED,
    BotMessageName.AUTO_REPLIES_FAILED,
  );

  applySavedVacanciesScheduler = createScheduledTask(
    savedVacancies,
    CRON.EVERY_3_HOURS,
    AUTO_REPLIES_RETRY_REPEAT_DELAY,
    MAX_RETRY_JOB_APPLICATION_RUN_COUNT,
    AppErrorName.JOB_APPLICATION_AUTO_APPLY_FAILED,
    BotMessageName.AUTO_REPLIES_FAILED,
  );

  autoCreateResumesScheduler = createScheduledTask(
    createResumes,
    CRON.EVERY_MONDAY_AT_9,
    AUTO_REPLIES_RETRY_REPEAT_DELAY,
    MAX_RETRY_JOB_APPLICATION_RUN_COUNT,
    AppErrorName.JOB_APPLICATION_AUTO_APPLY_FAILED,
    BotMessageName.AUTO_REPLIES_FAILED,
  );

  autoChattingByVacancies = createScheduledTask(
    chattingByVacancies,
    CRON.EVERY_3_HOURS,
    AUTO_REPLIES_RETRY_REPEAT_DELAY,
    MAX_RETRY_JOB_APPLICATION_RUN_COUNT,
    AppErrorName.JOB_APPLICATION_AUTO_APPLY_FAILED,
    BotMessageName.AUTO_REPLIES_FAILED,
  );

  const startSchedulers = async () => {
    autoRepliesScheduler.start();
    // autoChattingByVacancies.start();
    // autoCreateResumesScheduler.start();
    // applySavedVacanciesScheduler.start();
  };

  return {
    autoRepliesScheduler, applySavedVacanciesScheduler, startSchedulers,
  };
}
