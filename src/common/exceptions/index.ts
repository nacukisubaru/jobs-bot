export class AppException extends Error {
  readonly status?: number;

  readonly description?: string;

  readonly originalError?: Error;

  constructor(
    message: string,
    options: { status?: number; description?: string; cause?: unknown } = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.status = options.status;
    this.description = options.description;
    const { cause } = options;
    if (cause instanceof Error) {
      this.originalError = cause;
    } else if (typeof cause === 'string') {
      this.originalError = new Error(cause);
    } else if (cause) {
      this.originalError = new Error(JSON.stringify(cause));
    }

    if (this.originalError) {
      Object.defineProperty(this.originalError, 'message', { enumerable: true });
      Object.defineProperty(this.originalError, 'stack', { enumerable: true });
    }
  }
}
