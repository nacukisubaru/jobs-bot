export interface TaskDefinition {
  name: string;
  task: () => Promise<void>;
  cronExpression: string;
  attempts?: number;
  retryDelay?: number;
  priority?: number;
}

export interface AddTaskArgs {
  name: string,
  task: () => Promise<void>,
  cronExpression: string,
  attempts?: number,
  retryDelay?: number,
  priority?: number,
}
