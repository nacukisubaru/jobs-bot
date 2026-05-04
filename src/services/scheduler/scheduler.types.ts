export interface SchedulerOptions {
  errorMessages?: { bot: string; logger: string };
}

export type TaskFn = () => Promise<void>;

export interface QueuedTask {
  name: string;
  fn: TaskFn;
}
