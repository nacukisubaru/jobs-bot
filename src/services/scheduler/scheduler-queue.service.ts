import { logger } from '../../common/logger';

import { QueuedTask, TaskFn } from './scheduler.types';

class SchedulerQueue {
  private queue: QueuedTask[] = [];

  private isProcessing = false;

  enqueue(name: string, fn: TaskFn): void {
    const alreadyQueued = this.queue.some((item) => item.name === name);

    if (alreadyQueued) {
      logger.info(`[Queue] "${name}" уже в очереди, пропускаем`);

      return;
    }

    this.queue.push({ name, fn });

    logger.info(`[Queue] "${name}" добавлена в очередь`);

    this.process();
  }

  enqueueRetry(name: string, fn: TaskFn): void {
    this.queue.unshift({ name, fn });

    logger.info(`[Queue] "${name}" добавлена в начало очереди (retry)`);

    this.process();
  }

  private async process() {
    if (this.isProcessing) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift()!;

      logger.info(`[Queue] Запуск "${task.name}"`);

      try {
        await task.fn();

        logger.info(`[Queue] "${task.name}" завершена`);
      } catch (err) {
        logger.error(`[Queue] "${task.name}" упала`, err);
      }
    }

    this.isProcessing = false;
  }

  get processing() {
    return this.isProcessing;
  }
}

export const schedulerQueue = new SchedulerQueue();
