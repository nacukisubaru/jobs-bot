import mongoose from 'mongoose';
import { registerBotCommands } from './bot/main';
import { AppException } from './common/exceptions';

async function bootstrap() {
  registerBotCommands();

  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new AppException('MONGODB_URI_NOT_DEFINED');
  }

  await mongoose.connect(mongoUri);

  // Можно передать подключение в сервисы, если нужно
  // Или просто импортировать модели в сервисах

  console.log('Application started');
}

bootstrap().catch((err) => {
  console.error('Failed to start app', err);
  process.exit(1);
});