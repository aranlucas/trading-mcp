export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new TimeoutError(ms));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function raceToSuccess<T>(promises: Array<Promise<T | null>>): Promise<T> {
  const results = await Promise.allSettled(promises);

  for (const result of results) {
    if (result.status === "fulfilled" && result.value !== null) return result.value;
  }

  const errors: unknown[] = [];

  for (const result of results) {
    if (result.status === "rejected") errors.push(result.reason);
    else if (result.value === null) errors.push(new Error("Provider returned null"));
  }

  throw new AggregateError(errors, "All providers failed");
}
