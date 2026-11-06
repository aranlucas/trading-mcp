import { expect, it } from "vitest";
import { createBrokerTransport } from "../e2e/broker-transport.js";

it("forbids requests outside the paper broker fixture and duplicate submissions", async () => {
  const transport = createBrokerTransport();
  expect(() => transport("https://example.com")).toThrow(
    "Only the paper broker fixture is allowed",
  );

  const submit = () =>
    transport("https://paper-api.alpaca.markets/v2/orders", {
      method: "POST",
      body: JSON.stringify({
        symbol: "TEST",
        qty: "2",
        side: "buy",
        type: "limit",
        time_in_force: "day",
        limit_price: "100",
      }),
    });

  expect((await submit()).status).toBe(200);
  expect(() => submit()).toThrow("submission must not be duplicated");
});
