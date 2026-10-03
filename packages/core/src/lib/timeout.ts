export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

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
      // oxlint-disable-next-line anti-slop/no-unknown-parameters -- Promise rejection boundary forwards the original rejection without assuming its type.
      .catch((error: unknown) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
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
