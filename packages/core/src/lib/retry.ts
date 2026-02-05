import { TimeoutError } from "./timeout.js";

export type RetryOptions = {
  retries: number;
  minDelayMs: number;
  maxDelayMs: number;
  factor: number;
  jitter: number; // 0..1
  shouldRetry?: (err: unknown) => boolean;
};

const DEFAULT_OPTIONS: RetryOptions = {
  retries: 1,
  minDelayMs: 100,
  maxDelayMs: 1500,
  factor: 2,
  jitter: 0.2,
  shouldRetry: (err) => isRetryableError(err),
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function withJitter(ms: number, jitter: number): number {
  if (jitter <= 0) return ms;
  const delta = ms * jitter;
  const offset = (Math.random() * 2 - 1) * delta;
  return Math.max(0, Math.round(ms + offset));
}

export function isRetryableError(err: unknown): boolean {
  if (err instanceof TimeoutError) return true;

  if (err && typeof err === "object") {
    const maybe = err as { code?: unknown; name?: unknown; message?: unknown };
    const code = typeof maybe.code === "string" ? maybe.code : "";
    const name = typeof maybe.name === "string" ? maybe.name : "";
    const message = typeof maybe.message === "string" ? maybe.message : "";

    if (
      code === "ETIMEDOUT" ||
      code === "ECONNRESET" ||
      code === "EAI_AGAIN" ||
      code === "ENOTFOUND"
    ) {
      return true;
    }
    if (name === "FetchError") return true;
    if (message.toLowerCase().includes("fetch failed")) return true;
  }

  return false;
}

export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options?: Partial<RetryOptions>,
): Promise<T> {
  const opt: RetryOptions = { ...DEFAULT_OPTIONS, ...(options ?? {}) };

  let attempt = 0;
  while (true) {
    try {
      return await fn(attempt);
    } catch (err) {
      const shouldRetry = attempt < opt.retries && (opt.shouldRetry?.(err) ?? false);
      if (!shouldRetry) throw err;

      const base = opt.minDelayMs * Math.pow(opt.factor, attempt);
      const delayMs = withJitter(clamp(base, opt.minDelayMs, opt.maxDelayMs), opt.jitter);
      attempt += 1;
      await sleep(delayMs);
    }
  }
}
