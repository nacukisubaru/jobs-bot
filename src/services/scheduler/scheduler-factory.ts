import { AsyncScheduler } from './scheduler.service';

export function createScheduledTask(
  task: () => Promise<void>,
  cronExpression: string,
  retryDelay: number,
  maxRetryAttempts: number,
  loggerError: string,
  botMessageOnFail: string,
) {
  return new AsyncScheduler(
    task,
    cronExpression,
    retryDelay,
    maxRetryAttempts,
    {
      errorMessages: { logger: loggerError, bot: botMessageOnFail },
    },
  );
}
