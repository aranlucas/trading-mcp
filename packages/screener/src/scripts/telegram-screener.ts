import type { Signal } from "@trading/core";
import type { ScanCriteria, ScreenerScanResult } from "./lib/screener-api.js";
import { getMovers, getSignals, scan } from "./lib/screener-api.js";
import { sendTelegramText } from "./lib/telegram.js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}

type ScreenerProvider = "yahoo" | "alpaca";

function getProvider(): ScreenerProvider {
  const raw = (process.env.SCREENER_PROVIDER || "yahoo").trim().toLowerCase();
  return raw === "alpaca" ? "alpaca" : "yahoo";
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new Error(`Invalid ${name}: expected positive integer, got "${raw}"`);
  }
  return n;
}

function parseCsvSymbols(csv: string | undefined): string[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.toUpperCase())
    .slice(0, 100);
}

function formatCompactNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function fmtPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function fmtUsd(n: number): string {
  return n >= 100 ? n.toFixed(2) : n.toFixed(4);
}

function formatMoversBlock(title: string, movers: ScreenerScanResult[]): string {
  const lines = movers.map((m) => {
    const price = fmtUsd(m.price);
    const ch = fmtPct(m.changePercent);
    const vol = formatCompactNumber(m.volume);
    return `${m.symbol} $${price} (${ch}) vol ${vol}`;
  });
  return [title, ...lines].join("\n");
}

function formatSignalsBlock(signals: Signal[]): string {
  const bySymbol = new Map<string, Signal[]>();
  for (const s of signals) {
    const list = bySymbol.get(s.symbol) ?? [];
    list.push(s);
    bySymbol.set(s.symbol, list);
  }

  const symbols = [...bySymbol.keys()].sort();
  const lines: string[] = [];

  for (const sym of symbols) {
    const list = bySymbol.get(sym) ?? [];
    const top = list
      .slice()
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 3)
      .map((s) => `${s.type} (${s.direction}) ${Math.round(s.strength * 100)}%`)
      .join(", ");
    lines.push(`${sym}: ${top}`);
  }

  return ["Signals", ...lines].join("\n");
}

function formatScanBlock(results: ScreenerScanResult[], limit: number): string {
  const sorted = results
    .slice()
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
    .slice(0, limit);

  const lines = sorted.map((r) => {
    const flags = [
      r.rsi === undefined ? undefined : `RSI ${r.rsi.toFixed(1)}`,
      r.aboveSma20 === undefined ? undefined : r.aboveSma20 ? "above SMA20" : "below SMA20",
      r.aboveSma50 === undefined ? undefined : r.aboveSma50 ? "above SMA50" : "below SMA50",
    ].filter(Boolean);

    const meta = flags.length ? ` — ${flags.join(", ")}` : "";
    return `${r.symbol} $${fmtUsd(r.price)} (${fmtPct(r.changePercent)}) vol ${formatCompactNumber(r.volume)}${meta}`;
  });

  return ["Scan", ...lines].join("\n");
}

function nowStampUtc(): string {
  const iso = new Date().toISOString(); // 2026-02-05T12:34:56.789Z
  return `${iso.slice(0, 16).replace("T", " ")} UTC`;
}

type ReportKind = "movers" | "scan" | "signals";

async function buildReport(opts: {
  kind: ReportKind;
  limit: number;
  scanCriteria?: ScanCriteria;
  watchlist: string[];
}): Promise<string> {
  const header = `Screener update (${nowStampUtc()})`;

  if (opts.kind === "signals") {
    if (opts.watchlist.length === 0) throw new Error("SCREENER_WATCHLIST is required for signals report");
    const signals = await getSignals(opts.watchlist);
    return [header, "", formatSignalsBlock(signals)].join("\n");
  }

  if (opts.kind === "scan") {
    const criteria = opts.scanCriteria ?? {};
    if (criteria.symbols === undefined && opts.watchlist.length > 0) criteria.symbols = opts.watchlist;
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
    if (signals.length > 0) blocks.push("", formatSignalsBlock(signals));
  }

  return [header, "", ...blocks].join("\n");
}

async function main(): Promise<void> {
  const provider = getProvider();
  const kind = (process.env.SCREENER_REPORT?.trim() || "movers") as ReportKind;
  const limit = envInt("SCREENER_LIMIT", 10);
  const watchlist = parseCsvSymbols(process.env.SCREENER_WATCHLIST);

  const scanCriteriaRaw = process.env.SCREENER_SCAN_JSON?.trim();
  const scanCriteria: ScanCriteria | undefined = scanCriteriaRaw
    ? (JSON.parse(scanCriteriaRaw) as ScanCriteria)
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
