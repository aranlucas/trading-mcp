import { expect, it } from "vitest";
import { ScanCriteriaSchema } from "@/contracts.js";
import { ScanCriteriaSchema as ReportCriteriaSchema } from "@/scripts/lib/screener-api.js";
import { app } from "@/app.js";

it.each([{ minVolume: -1 }, { minRsi: 101 }, { symbols: ["bad/ticker"] }])(
  "rejects invalid criteria in report config and REST: %j",
  async (criteria) => {
    expect(ScanCriteriaSchema.safeParse(criteria).success).toBe(false);
    expect(ReportCriteriaSchema.safeParse(criteria).success).toBe(false);

    const response = await app.request("http://test/api/screener/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(criteria),
    });

    expect(response.status).toBe(400);
  },
);
