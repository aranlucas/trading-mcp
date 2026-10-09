import { z } from "zod";
import { TimeoutError } from "./timeout.js";

export type PublicError = {
  status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503 | 504;
  code: string;
  message: string;
};

type PublicStatus = PublicError["status"];

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly expose: boolean;
  readonly cause?: unknown;

  constructor(params: {
    message: string;
    status: number;
    code: string;
    expose?: boolean;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = this.constructor.name;
    this.status = params.status;
    this.code = params.code;
    this.expose = params.expose ?? false;
    this.cause = params.cause;
  }
}

export class ValidationError extends AppError {
  readonly issues?: z.ZodIssue[];

  constructor(message = "Invalid request", issues?: z.ZodIssue[]) {
    super({ message, status: 400, code: "VALIDATION_ERROR", expose: true });
    this.issues = issues;
  }
}

export class ProviderError extends AppError {
  readonly provider: string;
  readonly operation: string;

  constructor(params: { provider: string; operation: string; message?: string; cause?: unknown }) {
    super({
      message: params.message ?? "Upstream provider error",
      status: 502,
      code: "PROVIDER_ERROR",
      expose: true,
      cause: params.cause,
    });
    this.provider = params.provider;
    this.operation = params.operation;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super({ message, status: 404, code: "NOT_FOUND", expose: true });
  }
}

function toPublicStatus(status: number): PublicStatus {
  switch (status) {
    case 400:
    case 401:
    case 403:
    case 404:
    case 409:
    case 422:
    case 429:
    case 500:
    case 502:
    case 503:
    case 504:
      return status;
    default:
      return 500;
  }
}

export function toPublicError(err: unknown): PublicError {
  if (err instanceof AppError) {
    return {
      status: toPublicStatus(err.status),
      code: err.code,
      message: err.expose ? err.message : "Internal server error",
    };
  }

  if (err instanceof z.ZodError) {
    return {
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Invalid request",
    };
  }

  if (err instanceof TimeoutError) {
    return {
      status: 504,
      code: "TIMEOUT",
      message: "Request timed out",
    };
  }

  return {
    status: 500,
    code: "INTERNAL_ERROR",
    message: "Internal server error",
  };
}
