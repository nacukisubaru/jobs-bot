import mongoose from 'mongoose';

import { registerBotCommands } from './bot/main';
import { initAutoRepliesSchedulers } from './bot/tasks/auto-replies-tasks';

import { AppException } from './common/exceptions';
import { PROFILE_PATH } from './common/constants/common';

import { BrowserService } from './services/browser/browser.service';

async function bootstrap() {
  registerBotCommands();

  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new AppException('MONGODB_URI_NOT_DEFINED');
  }

  await mongoose.connect(mongoUri);

  console.log('Application started');

  const startJobsBot = async () => {
    const browser = new BrowserService(PROFILE_PATH);

    await browser.start();

    const { startSchedulers } = initAutoRepliesSchedulers(browser);

    startSchedulers();
  };

  if (process.env.START_JOBS_BOT === 'true') {
    startJobsBot();
  }
}

bootstrap().catch((err) => {
  console.error('Failed to start app', err);
  process.exit(1);
});
