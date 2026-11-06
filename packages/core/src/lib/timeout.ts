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

export function raceToSuccess<T>(promises: Array<Promise<T | null>>): Promise<T> {
  return Promise.any(
    promises.map(async (promise) => {
      const value = await promise;

      if (value === null) {
        throw new Error("Provider returned null");
      }

      return value;
    }),
  ).catch((error: AggregateError) => {
    throw new AggregateError(error.errors, "All providers failed");
  });
}
