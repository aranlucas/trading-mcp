import { z } from "zod";

export const SymbolSchema = z
  .string()
  .min(1)
  .max(10)
  .regex(/^[A-Z0-9.]+$/i, "Invalid symbol format");

export const ScanCriteriaSchema = z.object({
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  minVolume: z.number().min(0).optional(),
  minRsi: z.number().min(0).max(100).optional(),
  maxRsi: z.number().min(0).max(100).optional(),
  aboveSma20: z.boolean().optional(),
  aboveSma50: z.boolean().optional(),
  symbols: z.array(SymbolSchema).max(100).optional(),
});

export type ScanCriteria = z.infer<typeof ScanCriteriaSchema>;

export const SignalSchema = z.object({
  symbol: z.string(),
  type: z.string(),
  direction: z.enum(["bullish", "bearish", "neutral"]),
  strength: z.number(),
  timestamp: z.string(),
  description: z.string(),
});

export const ScanResultSchema = z.object({
  symbol: z.string(),
  price: z.number().positive(),
  volume: z.number().nonnegative().nullable(),
  change: z.number().nullable(),
  changePercent: z.number().nullable(),
  rsi: z.number().optional(),
  aboveSma20: z.boolean().optional(),
  aboveSma50: z.boolean().optional(),
});

export type ScanResult = z.infer<typeof ScanResultSchema>;

export const MoverResultSchema = ScanResultSchema.extend({ changePercent: z.number() });

export type MoverResult = z.infer<typeof MoverResultSchema>;
