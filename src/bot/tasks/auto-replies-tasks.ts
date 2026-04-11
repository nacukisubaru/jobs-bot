import { VacancyApplicationService } from '../../services/vacancy-application/vacancy-applications.service';
import { BrowserService } from '../../services/browser/browser.service';
import { ResumeService } from '../../services/resume/resume.service';
import { VacancyService } from '../../services/vacancy/vacancy.service';
import { GPTService } from '../../services/chatgpt/chatgpt.service';

import {
  AUTO_REPLIES_RETRY_REPEAT_DELAY,
  AUTO_REPLIES_DELAY, AUTO_REPLIES_REPEAT_DELAY, AUTO_REPLIES_RETRY_DELAY, MAX_RETRY_JOB_APPLICATION_RUN_COUNT,
} from '../../common/constants/common';
import { AppErrorName } from '../../common/constants/errors';
import { BotMessageName } from '../../common/constants/bot';
import { createScheduledTask } from '../../services/scheduler/scheduler-factory';
import { AsyncScheduler } from '../../services/scheduler/scheduler.service';

let autoRepliesScheduler: AsyncScheduler;
let applySavedVacanciesScheduler: AsyncScheduler;

export function initAutoRepliesSchedulers(browser: BrowserService) {
  const context = browser.getContext();

  const gptService = new GPTService();
  const vacancyService = new VacancyService(context);
  const resumeService = new ResumeService(context);

  const vacancyApplicationService = new VacancyApplicationService(context, vacancyService, gptService, resumeService);

  autoRepliesScheduler = createScheduledTask(
    () => vacancyApplicationService.processNewVacancies(),
    AUTO_REPLIES_DELAY,
    AUTO_REPLIES_RETRY_DELAY,
    MAX_RETRY_JOB_APPLICATION_RUN_COUNT,
    AppErrorName.JOB_APPLICATION_AUTO_APPLY_FAILED,
    BotMessageName.AUTO_REPLIES_FAILED,
  );

  applySavedVacanciesScheduler = createScheduledTask(
    () => vacancyApplicationService.processSavedVacancies(),
    AUTO_REPLIES_REPEAT_DELAY,
    AUTO_REPLIES_RETRY_REPEAT_DELAY,
    MAX_RETRY_JOB_APPLICATION_RUN_COUNT,
    AppErrorName.JOB_APPLICATION_AUTO_APPLY_FAILED,
    BotMessageName.AUTO_REPLIES_FAILED,
  );

  const startSchedulers = async () => {
    autoRepliesScheduler.start();
    //applySavedVacanciesScheduler.start();
  };

  return {
    autoRepliesScheduler, applySavedVacanciesScheduler, startSchedulers,
  };
}
