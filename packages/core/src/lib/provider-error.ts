import { AppError } from "./app-error.js";

type ProviderErrorOptions = {
  provider: string;
  operation: string;
  message?: string;
  cause?: unknown;
};

export class ProviderError extends AppError {
  readonly provider: string;
  readonly operation: string;

  constructor(params: ProviderErrorOptions) {
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
