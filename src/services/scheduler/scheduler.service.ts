import cron from 'node-cron';

import { bot } from '../../bot/bot';
import { TG_CHAT_ID } from '../../common/constants/common';
import { logger } from '../../common/logger';
import { schedulerQueue } from './scheduler-queue.service';
import { SchedulerOptions } from './scheduler.types';

export class AsyncScheduler {
  private cronJob: cron.ScheduledTask | null = null;

  private retryCount = 0;

  private retryTimeout: NodeJS.Timeout | null = null;

  private isStopped = false;

  private taskName: string;

  constructor(
    private task: () => Promise<void>,
    private cronExpression: string,
    private retryDelay: number,
    private maxRetryAttempts: number,
    private options: SchedulerOptions = {},
  ) {
    this.taskName = task.name;
  }

  public start() {
    this.isStopped = false;

    this.cronJob = cron.schedule(this.cronExpression, () => {
      if (this.isStopped) return;

      logger.info(`[Scheduler] Cron сработал для "${this.taskName}"`);

      schedulerQueue.enqueue(this.taskName, () => this.execute());
    });

    logger.info(`[Scheduler] "${this.taskName}" запущен (${this.cronExpression})`);
  }

  public stop() {
    this.isStopped = true;

    this.cronJob?.stop();

    this.cronJob = null;

    if (this.retryTimeout) clearTimeout(this.retryTimeout);

    logger.info(`[Scheduler] "${this.taskName}" остановлен`);
  }

  public getCronExpression() {
    return this.cronExpression;
  }

  private async execute(): Promise<void> {
    try {
      await this.task();

      this.retryCount = 0;
    } catch (err) {
      if (this.retryCount < this.maxRetryAttempts) {
        this.retryCount++;

        this.notifyError(err);

        await new Promise<void>((resolve) => {
          this.retryTimeout = setTimeout(() => {
            schedulerQueue.enqueueRetry(this.taskName, () => this.execute());

            resolve();
          }, this.retryDelay);
        });
      } else {
        this.retryCount = 0;

        logger.error(`[Scheduler] "${this.taskName}" исчерпала все попытки`, err);

        throw err;
      }
    }
  }

  private notifyError(err: unknown) {
    const msg = this.options.errorMessages;

    if (!msg) return;

    logger.error(`${msg.logger} retry (${this.retryCount}/${this.maxRetryAttempts})`, err);

    bot.sendMessage(TG_CHAT_ID, `Повторная попытка №${this.retryCount} ${msg.bot} ${err}`);
  }
}
