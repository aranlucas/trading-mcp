import { afterEach, describe, expect, it, vi } from "vitest";
import { yahoo, yahooFinance } from "../providers/yahoo.js";

describe("yahoo provider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws when Yahoo returns an invalid quote payload", async () => {
    vi.spyOn(yahooFinance, "quote").mockResolvedValueOnce(123 as unknown as never);

    await expect(yahoo.getQuoteNormalized("AAPL")).rejects.toThrow("Invalid Yahoo quote response");
  });
});
