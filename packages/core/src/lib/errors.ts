import { z } from "zod";
import { TimeoutError } from "./timeout.js";
import { AppError } from "./app-error.js";
export { AppError } from "./app-error.js";
export { ValidationError } from "./validation-error.js";
export { ProviderError } from "./provider-error.js";
export { NotFoundError } from "./not-found-error.js";

export type PublicError = {
  status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503 | 504;
  code: string;
  message: string;
};

type PublicStatus = PublicError["status"];

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
