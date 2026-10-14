type AppErrorOptions = {
  message: string;
  status: number;
  code: string;
  expose?: boolean;
  cause?: unknown;
};

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly expose: boolean;
  readonly cause?: unknown;

  constructor(params: AppErrorOptions) {
    super(params.message);
    this.name = this.constructor.name;
    this.status = params.status;
    this.code = params.code;
    this.expose = params.expose ?? false;
    this.cause = params.cause;
  }
}
