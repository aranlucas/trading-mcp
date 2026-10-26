type ReportOptions = {
  kind: ReportKind;
  limit: number;
  scanCriteria?: ScanCriteria;
  watchlist: string[];
};

import { z } from "zod";
import type { ScanCriteria } from "./lib/screener-api.js";
import { getMovers, getSignals, scan, ScanCriteriaSchema } from "./lib/screener-api.js";
import { sendTelegramText } from "./lib/telegram.js";
import { formatMoversBlock, formatScanBlock, formatSignalsBlock } from "./lib/report.js";

function requireEnv(name: string): string {
  const v = process.env[name];

  if (!v || v.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return v.trim();
}

type ScreenerProvider = "yahoo" | "alpaca";

function getProvider(): ScreenerProvider {
  const raw = (
    process.env.SCREENER_PROVIDER === "" ? "yahoo" : (process.env.SCREENER_PROVIDER ?? "yahoo")
  )
    .trim()
    .toLowerCase();

  return raw === "alpaca" ? "alpaca" : "yahoo";
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();

  if (!raw) {
    return fallback;
  }

  const n = Number(raw);

  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new Error(`Invalid ${name}: expected positive integer, got "${raw}"`);
  }

  return n;
}

function parseCsvSymbols(csv: string | undefined): string[] {
  if (!csv) {
    return [];
  }

  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.toUpperCase())
    .slice(0, 100);
}

function nowStampUtc(): string {
  const iso = new Date().toISOString(); // 2026-02-05T12:34:56.789Z

  return `${iso.slice(0, 16).replace("T", " ")} UTC`;
}

type ReportKind = "movers" | "scan" | "signals";

async function buildReport(opts: ReportOptions): Promise<string> {
  const header = `Screener update (${nowStampUtc()})`;

  if (opts.kind === "signals") {
    if (opts.watchlist.length === 0) {
      throw new Error("SCREENER_WATCHLIST is required for signals report");
    }

    const signals = await getSignals(opts.watchlist);

    return [header, "", formatSignalsBlock(signals)].join("\n");
  }

  if (opts.kind === "scan") {
    const criteria = opts.scanCriteria ?? {};

    if (criteria.symbols === undefined && opts.watchlist.length > 0) {
      criteria.symbols = opts.watchlist;
    }

    const results = await scan(criteria);

    return [header, "", formatScanBlock(results, opts.limit)].join("\n");
  }

  const [gainers, losers] = await Promise.all([
    getMovers({ direction: "gainers", limit: opts.limit }),
    getMovers({ direction: "losers", limit: opts.limit }),
  ]);

  const blocks = [
    formatMoversBlock(`Top ${opts.limit} gainers`, gainers),
    "",
    formatMoversBlock(`Top ${opts.limit} losers`, losers),
  ];

  if (opts.watchlist.length > 0) {
    const signals = await getSignals(opts.watchlist);

    if (signals.length > 0) {
      blocks.push("", formatSignalsBlock(signals));
    }
  }

  return [header, "", ...blocks].join("\n");
}

async function main(): Promise<void> {
  const provider = getProvider();

  const report = process.env.SCREENER_REPORT?.trim();

  const kind = z
    .enum(["movers", "signals", "scan"])
    .parse(report === "" ? "movers" : (report ?? "movers"));

  const limit = envInt("SCREENER_LIMIT", 10);
  const watchlist = parseCsvSymbols(process.env.SCREENER_WATCHLIST);

  const scanCriteriaRaw = process.env.SCREENER_SCAN_JSON?.trim();

  const scanCriteria: ScanCriteria | undefined = scanCriteriaRaw
    ? ScanCriteriaSchema.parse(JSON.parse(scanCriteriaRaw))
    : undefined;

  if (provider === "alpaca") {
    requireEnv("ALPACA_API_KEY");
    requireEnv("ALPACA_API_SECRET");
  }

  const text = await buildReport({
    kind,
    limit,
    scanCriteria,
    watchlist,
  });

  if (process.env.DRY_RUN === "1") {
    console.log(text);

    return;
  }

  await sendTelegramText({
    botToken: requireEnv("TELEGRAM_BOT_TOKEN"),
    chatId: requireEnv("TELEGRAM_CHAT_ID"),
    messageThreadId: process.env.TELEGRAM_MESSAGE_THREAD_ID?.trim(),
    text,
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
