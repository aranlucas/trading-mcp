import { AppError } from "./app-error.js";

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super({ message, status: 404, code: "NOT_FOUND", expose: true });
  }
}
