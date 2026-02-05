/**
 * Utility for timeout-based promise operations
 */

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Wraps a promise with a timeout. Rejects with TimeoutError if the promise
 * doesn't resolve within the specified time.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new TimeoutError(ms));
    }, ms);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error: unknown) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Runs multiple promises in parallel and returns the first successful result.
 * If all promises fail, throws an AggregateError with all the errors.
 */
export async function raceToSuccess<T>(promises: Promise<T | null>[]): Promise<T> {
  const results = await Promise.allSettled(promises);

  // Find the first fulfilled result that is not null
  for (const result of results) {
    if (result.status === "fulfilled" && result.value !== null) {
      return result.value;
    }
  }

  // All failed or returned null - collect errors
  const errors = results
    .filter(
      (r): r is PromiseRejectedResult =>
        r.status === "rejected" || (r.status === "fulfilled" && r.value === null),
    )
    .map((r) => (r.status === "rejected" ? r.reason : new Error("Provider returned null")));

  throw new AggregateError(errors, "All providers failed");
}
