import { bot } from '../../bot/bot';

import { AUTO_REPLIES_RETRY_DELAY, TG_CHAT_ID } from '../../common/constants/common';
import { logger } from '../../common/logger';

export class AsyncScheduler {
  private timeoutHandle: NodeJS.Timeout | null = null;

  private retryCount: number = 0;

  constructor(
    private task: () => Promise<void>,
    private delay: number,
    private retryDelay: number = AUTO_REPLIES_RETRY_DELAY,
    private maxRetryAttempts: number = 1,
    private errorMessages: { bot: string, logger: string } | null = null,
  ) {}

  private async runTask() {
    try {
      await this.task();

      this.retryCount = 0;
    } catch (err) {
      if (this.retryCount < this.maxRetryAttempts) {
        this.retryCount++;

        if (this.errorMessages) {
          logger.error(
            `${this.errorMessages.logger}
            retry (${this.retryCount}/${this.maxRetryAttempts})`,
            err,
          );

          bot.sendMessage(TG_CHAT_ID, `Повторная попытка №${this.retryCount} ${this.errorMessages.bot} ${err}`);
        }

        this.scheduleNext(this.retryDelay);
      } else {
        this.retryCount = 0;
      }

      return;
    }

    this.scheduleNext(this.delay);
  }

  private scheduleNext(ms: number) {
    if (this.timeoutHandle) clearTimeout(this.timeoutHandle);

    this.timeoutHandle = setTimeout(() => this.runTask(), ms);
  }

  public start() {
    this.runTask();
  }

  public stop() {
    if (this.timeoutHandle) clearTimeout(this.timeoutHandle);

    this.timeoutHandle = null;
  }
}
