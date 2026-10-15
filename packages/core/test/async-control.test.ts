import { afterEach, describe, expect, it, vi } from "vitest";
import { withRetry } from "@/lib/retry.js";
import { forEachSequential } from "@/lib/sequential.js";
import { TimeoutError, withTimeout } from "@/lib/timeout.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("sequential work", () => {
  it("waits for each operation before starting the next", async () => {
    const first = Promise.withResolvers<void>();
    const second = Promise.withResolvers<void>();

    const visit = vi
      .fn<(item: number) => Promise<void>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const pending = forEachSequential([1, 2], visit);

    expect(visit.mock.calls).toEqual([[1]]);
    first.resolve();
    await vi.waitFor(() => expect(visit.mock.calls).toEqual([[1], [2]]));
    second.resolve();
    await pending;
  });

  it("stops at a rejected operation and preserves its error", async () => {
    const error = new Error("Provider unavailable");

    const visit = vi
      .fn<(item: number) => Promise<void>>()
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(error);

    await expect(forEachSequential([1, 2, 3], visit)).rejects.toBe(error);
    expect(visit.mock.calls).toEqual([[1], [2]]);
  });

  it("does not invoke the visitor for an empty input", async () => {
    const visit = vi.fn<(item: number) => Promise<void>>();

    await forEachSequential([], visit);
    expect(visit).not.toHaveBeenCalled();
  });
});

describe("retry timing", () => {
  it("preserves zero-based attempts, exponential backoff, and the delay cap", async () => {
    vi.useFakeTimers();
    const failure = new Error("Transient failure");

    const operation = vi
      .fn<(attempt: number) => Promise<string>>()
      .mockRejectedValueOnce(failure)
      .mockRejectedValueOnce(failure)
      .mockResolvedValue("ok");

    const result = withRetry(operation, {
      retries: 2,
      minDelayMs: 100,
      maxDelayMs: 150,
      factor: 2,
      jitter: 0,
      shouldRetry: () => true,
    });

    await vi.advanceTimersByTimeAsync(99);
    expect(operation.mock.calls).toEqual([[0]]);
    await vi.advanceTimersByTimeAsync(1);
    expect(operation.mock.calls).toEqual([[0], [1]]);
    await vi.advanceTimersByTimeAsync(149);
    expect(operation).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await expect(result).resolves.toBe("ok");
    expect(operation.mock.calls).toEqual([[0], [1], [2]]);
  });

  it("does not retry a nonretryable failure", async () => {
    const failure = new Error("Invalid request");
    const operation = vi.fn<(attempt: number) => Promise<never>>().mockRejectedValue(failure);

    await expect(withRetry(operation, { retries: 3 })).rejects.toBe(failure);
    expect(operation.mock.calls).toEqual([[0]]);
  });
});

describe("timeouts", () => {
  it("clears the timer on success", async () => {
    vi.useFakeTimers();
    await expect(withTimeout(Promise.resolve("ready"), 100)).resolves.toBe("ready");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("preserves non-Error rejections and clears the timer", async () => {
    vi.useFakeTimers();
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue("upstream reason");

    await expect(withTimeout(operation(), 100)).rejects.toBe("upstream reason");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects after the deadline without leaving a timer", async () => {
    vi.useFakeTimers();
    const deferred = Promise.withResolvers<void>();
    const result = withTimeout(deferred.promise, 100);
    // The test intentionally observes arbitrary rejection values to verify they are preserved.
    // oxlint-disable-next-line anti-slop/no-unknown-parameters
    const rejection = result.catch((error: unknown) => error);

    await vi.advanceTimersByTimeAsync(100);
    expect(await rejection).toEqual(new TimeoutError(100));
    expect(vi.getTimerCount()).toBe(0);
    deferred.resolve();
  });
});
