import 'dotenv/config';

import mongoose from 'mongoose';

import { registerBotCommands } from './bot/main';

import { AppException } from './common/exceptions';

import { appContainer } from './app-container';

async function bootstrap() {
  registerBotCommands();

  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new AppException('MONGODB_URI_NOT_DEFINED');
  }

  await mongoose.connect(mongoUri);

  console.log('Application started');

  const startJobsBot = async () => {
    await appContainer.init(false);
  };

  startJobsBot();
}

bootstrap().catch((err) => {
  console.error('Failed to start app', err);
  process.exit(1);
});
