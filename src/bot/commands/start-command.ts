import type { BrowserContext } from 'playwright';
import TelegramBot from 'node-telegram-bot-api';

import { JobApplicationService } from '../../services/job-application/job-application.service';
import { VacancyService } from '../../services/vacancy/vacancy.service';
import { GPTService } from '../../services/chatgpt/chatgpt.service';

import { bot } from '../bot';

import { BrowserService } from '../../services/browser/browser.service';
import { ResumeService } from '../../services/resume/resume.service';
import { AsyncScheduler } from '../../services/scheduler/scheduler.service';

import { logger } from '../../common/logger';
import { BotMessageName } from '../../common/constants/bot';
import { AppErrorName } from '../../common/constants/errors';
import {
  AUTO_REPLIES_DELAY, AUTO_REPLIES_RETRY_DELAY, MAX_RETRY_JOB_APPLICATION_RUN_COUNT, PROFILE_PATH,
} from '../../common/constants/common';

let autoRepliesScheduler: AsyncScheduler;

const browser = new BrowserService(PROFILE_PATH);

async function startAutoReplies(chatId: number): Promise<void> {
  try {
    autoRepliesScheduler = new AsyncScheduler(
      async () => {
        const context: BrowserContext = browser.getContext();

        const jobService = new JobApplicationService(
          context,
          new VacancyService(context),
          new GPTService(),
          new ResumeService(context),
        );

        bot.sendMessage(chatId, BotMessageName.AUTO_REPLIES_RUN);

        await jobService.run();
      },
      AUTO_REPLIES_DELAY,
      AUTO_REPLIES_RETRY_DELAY,
      MAX_RETRY_JOB_APPLICATION_RUN_COUNT,
      {
        logger: AppErrorName.JOB_APPLICATION_AUTO_APPLY_FAILED,
        bot: BotMessageName.AUTO_REPLIES_FAILED,
      },
    );

    autoRepliesScheduler.start();
  } catch (err) {
    logger.error(AppErrorName.BOT_AUTO_REPLIES_RUN_ERROR, err);

    bot.sendMessage(chatId, `${BotMessageName.AUTO_REPLIES_RUN_ERROR} ${err}`);
  }
}

export async function startCommand(msg: TelegramBot.Message) {
  const chatId = msg.chat.id;

  await browser.start();

  bot.sendMessage(chatId, BotMessageName.CHECKING_AUTORIZE).then(async () => {
    const isAuth = await browser.isAuth();

    if (!isAuth) {
      bot.sendMessage(
        chatId,
        `${BotMessageName.AUTHORIZATION_ERROR} ${process.env.UPLOAD_PROFILE_SERVER}`,
      );

      return;
    }

    bot.sendMessage(chatId, BotMessageName.AUTHORIZATION_SUCCESS);

    startAutoReplies(chatId);
  });
}

export async function stopCommand(msg: TelegramBot.Message) {
  const chatId = msg.chat.id;

  if (autoRepliesScheduler.taskIsRunning()) {
    bot.sendMessage(chatId, BotMessageName.AUTO_REPLIES_IS_RUNNING_WAIT);
  }

  autoRepliesScheduler.stop(async () => {
    await browser.stop();

    bot.sendMessage(chatId, BotMessageName.AUTO_REPLIES_IS_STOPPED);
  });
}
