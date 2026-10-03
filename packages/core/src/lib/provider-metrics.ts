import { z } from "zod";

export type ProviderOperation = "getQuote";

export type ProviderMetricPoint = {
  provider: string;
  operation: ProviderOperation;
  ok: boolean;
  latencyMs: number;
  at: number; // epoch ms
  error?: string;
};

export type ProviderMetricSnapshot = {
  windowMs: number;
  providers: Record<
    string,
    Partial<
      Record<
        ProviderOperation,
        {
          rolling: {
            total: number;
            success: number;
            failure: number;
            errorRate: number;
          };
          totals: {
            success: number;
            failure: number;
          };
          latencyEmaMs?: number;
          lastError?: { at: string; message: string };
        }
      >
    >
  >;
};

type ProviderMetricsOptions = {
  windowMs: number;
};

class RollingWindowCounter {
  private readonly windowMs: number;
  private events: number[] = [];
  private head = 0;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  add(at: number) {
    this.events.push(at);
    this.prune(at);
    this.compactIfNeeded();
  }

  count(now: number): number {
    this.prune(now);

    return this.events.length - this.head;
  }

  private prune(now: number) {
    const cutoff = now - this.windowMs;

    while (this.head < this.events.length) {
      const t = this.events[this.head];

      if (t !== undefined && t >= cutoff) break;
      this.head += 1;
    }
  }

  private compactIfNeeded() {
    if (this.head < 1000) return;
    this.events = this.events.slice(this.head);
    this.head = 0;
  }
}

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- JavaScript throw values are untrusted; this error boundary parses supported messages and safely stringifies the rest.
function normalizeErrorMessage(err: unknown): string {
  const parsed = z
    .union([z.string(), z.object({ message: z.string() }).transform((value) => value.message)])
    .safeParse(err);

  const raw = parsed.success ? parsed.data : String(err);

  // Redact common secret-bearing query params (best-effort).
  return raw.replace(
    /([?&](?:apiKey|apikey|token|access_token|key|secret|signature)=)[^&\s]+/gi,
    "$1[REDACTED]",
  );
}

type OpStats = {
  rollingSuccess: RollingWindowCounter;
  rollingFailure: RollingWindowCounter;
  totalSuccess: number;
  totalFailure: number;
  latencyEmaMs?: number;
  lastError?: { at: number; message: string };
};

export function createProviderMetrics(options: ProviderMetricsOptions) {
  const windowMs = options.windowMs;
  const store = new Map<string, Map<ProviderOperation, OpStats>>();

  function getOp(provider: string, operation: ProviderOperation): OpStats {
    let byOp = store.get(provider);

    if (!byOp) {
      byOp = new Map();
      store.set(provider, byOp);
    }

    let stats = byOp.get(operation);

    if (!stats) {
      stats = {
        rollingSuccess: new RollingWindowCounter(windowMs),
        rollingFailure: new RollingWindowCounter(windowMs),
        totalSuccess: 0,
        totalFailure: 0,
      };
      byOp.set(operation, stats);
    }

    return stats;
  }

  function record(point: ProviderMetricPoint) {
    const stats = getOp(point.provider, point.operation);
    const alpha = 0.2;
    stats.latencyEmaMs =
      stats.latencyEmaMs === undefined
        ? point.latencyMs
        : stats.latencyEmaMs * (1 - alpha) + point.latencyMs * alpha;

    if (point.ok) {
      stats.totalSuccess += 1;
      stats.rollingSuccess.add(point.at);
    } else {
      stats.totalFailure += 1;
      stats.rollingFailure.add(point.at);
      stats.lastError = {
        at: point.at,
        message: point.error ?? "Unknown error",
      };
    }
  }

  function snapshot(now = Date.now()): ProviderMetricSnapshot {
    const providers: ProviderMetricSnapshot["providers"] = {};

    for (const [provider, byOp] of store.entries()) {
      const opObj: ProviderMetricSnapshot["providers"][string] = {};

      for (const [operation, stats] of byOp.entries()) {
        const success = stats.rollingSuccess.count(now);
        const failure = stats.rollingFailure.count(now);
        const total = success + failure;
        opObj[operation] = {
          rolling: {
            total,
            success,
            failure,
            errorRate: total === 0 ? 0 : failure / total,
          },
          totals: {
            success: stats.totalSuccess,
            failure: stats.totalFailure,
          },
          latencyEmaMs: stats.latencyEmaMs,
          lastError: stats.lastError
            ? { at: new Date(stats.lastError.at).toISOString(), message: stats.lastError.message }
            : undefined,
        };
      }

      providers[provider] = opObj;
    }

    return { windowMs, providers };
  }

  function reset() {
    store.clear();
  }

  return {
    recordSuccess(params: {
      provider: string;
      operation: ProviderOperation;
      latencyMs: number;
      at?: number;
    }) {
      record({
        provider: params.provider,
        operation: params.operation,
        ok: true,
        latencyMs: params.latencyMs,
        at: params.at ?? Date.now(),
      });
    },
    recordFailure(params: {
      provider: string;
      operation: ProviderOperation;
      latencyMs: number;
      err: unknown;
      at?: number;
    }) {
      record({
        provider: params.provider,
        operation: params.operation,
        ok: false,
        latencyMs: params.latencyMs,
        at: params.at ?? Date.now(),
        error: normalizeErrorMessage(params.err),
      });
    },
    snapshot,
    reset,
  } as const;
}
