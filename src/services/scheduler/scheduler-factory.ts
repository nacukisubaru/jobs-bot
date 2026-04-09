import { AsyncScheduler } from './scheduler.service';

export function createScheduledTask(
  task: () => Promise<void>,
  delay: number,
  retryDelay: number,
  maxRuns: number,
  loggerError: string,
  botMessageOnFail: string,
) {
  return new AsyncScheduler(
    async () => {
      await task();
    },
    delay,
    retryDelay,
    maxRuns,
    {
      logger: loggerError,
      bot: botMessageOnFail,
    },
  );
}
