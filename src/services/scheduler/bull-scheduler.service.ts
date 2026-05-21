import { Queue, Worker, Job } from 'bullmq';

import { logger } from '../../common/logger';
import { timeToCron } from '../../common/utils/common';
import { AddTaskArgs, TaskDefinition } from './scheduler.types';

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
};

export class BullScheduler {
  private queue: Queue;

  private worker: Worker;

  private tasks: Map<string, () => Promise<void>> = new Map();

  private running = false;

  constructor(private taskDefinitions: TaskDefinition[]) {
    this.queue = new Queue('scheduler', { connection });

    taskDefinitions.forEach(({ name, task }) => {
      this.tasks.set(name, task);
    });

    this.worker = new Worker('scheduler', async (job: Job) => {
      const task = this.tasks.get(job.name);

      if (!task) throw new Error(`Unknown task: ${job.name}`);

      const activeJobs = await this.queue.getActive();

      const alreadyRunning = activeJobs.some(
        (j) => j.name === job.name && j.id !== job.id,
      );

      if (alreadyRunning) {
        logger.warn(`[BullMQ] ${job.name} already running, skipping`);

        return;
      }

      await task();
    }, { connection });

    this.worker.on('completed', (job) => {
      logger.info(`[BullMQ] ${job.name} completed`);
    });

    this.worker.on('failed', (job, err) => {
      logger.error(`[BullMQ] ${job?.name} failed`, err);
    });
  }

  isRunning(): boolean {
    return this.running;
  }

  addTask({
    name, cronExpression, attempts, retryDelay,
  }: AddTaskArgs) {
    return this.queue.add(name, {}, {
      repeat: { pattern: cronExpression },
      attempts,
      removeOnComplete: true,
      ...(retryDelay && { backoff: { type: 'fixed', delay: retryDelay } }),
    });
  }

  async scheduleByTimes(times: string[], taskName: string): Promise<void> {
    const existingJobs = await this.queue.getJobSchedulers();

    for (const job of existingJobs) {
      if (job.name.startsWith(taskName)) {
        await this.queue.removeJobScheduler(job.id as string);
      }
    }

    for (const time of times) {
      const name = `${taskName}_${time}`;

      this.addTask({
        name,
        cronExpression: timeToCron(time),
      });

      console.log(`Запланирована задача ${taskName} по времени: ${time}`);
    }
  }

  async start(runOnInit = false): Promise<void> {
    if (this.running) {
      logger.info('[BullMQ] Already running');

      return;
    }

    const repeatableJobs = await this.queue.getJobSchedulers();
    const existingNames = repeatableJobs.map((j) => j.name);

    for (const {
      name, cronExpression, attempts = 3, retryDelay = 5000,
    } of this.taskDefinitions) {
      if (!existingNames.includes(name)) {
        this.addTask({
          name, cronExpression, attempts, retryDelay,
        });
        logger.info(`[BullMQ] Registered task: ${name}`);
      } else {
        logger.info(`[BullMQ] Task already exists: ${name}`);
      }

      if (runOnInit) {
        await this.queue.add(name, {}, { removeOnComplete: true });
      }
    }

    this.running = true;
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    await this.worker.close();
    await this.queue.close();

    this.running = false;
  }
}
