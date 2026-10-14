import { AppError } from "./app-error.js";
import type { z } from "zod";

export class ValidationError extends AppError {
  readonly issues?: z.ZodIssue[];

  constructor(message = "Invalid request", issues?: z.ZodIssue[]) {
    super({ message, status: 400, code: "VALIDATION_ERROR", expose: true });
    this.issues = issues;
  }
}
