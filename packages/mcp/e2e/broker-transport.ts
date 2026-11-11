// Native runner configuration cannot emulate Alpaca transport; this fixture enforces the repository-specific order journey without network access.
import { strict as assert } from "node:assert";
import { z } from "zod";

export function createBrokerTransport(): typeof fetch {
  let order: Record<string, string> | undefined;

  let readsAfterCancel = 0;

  let canceled = false;

  return (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    assert.equal(
      url.origin,
      "https://paper-api.alpaca.markets",
      "Only the paper broker fixture is allowed",
    );

    if (init?.method === "POST") {
      assert.equal(order, undefined, "submission must not be duplicated");

      const { client_order_id: clientOrderId, ...body } = z
        .object({ client_order_id: z.string().min(1) })
        .catchall(z.string())
        .parse(JSON.parse(z.string().parse(init.body)));

      assert.deepEqual(body, {
        symbol: "TEST",
        qty: "2",
        side: "buy",
        type: "limit",
        time_in_force: "day",
        limit_price: "100",
      });
      order = {
        id: "fixture-order",
        client_order_id: clientOrderId,
        ...body,
        status: "new",
        filled_qty: "0",
      };

      return Promise.resolve(Response.json(order));
    }

    assert.ok(order, "an order must exist before lookup/cancel");

    if (url.pathname === "/v2/orders:by_client_order_id") {
      return Promise.resolve(
        url.searchParams.get("client_order_id") === order.client_order_id
          ? Response.json(order)
          : Response.json({ message: "order not found" }, { status: 404 }),
      );
    }

    assert.equal(url.pathname, "/v2/orders/fixture-order");

    if (init?.method === "DELETE") {
      canceled = true;

      return Promise.resolve(new Response(null, { status: 204 }));
    }

    return Promise.resolve(
      Response.json({
        ...order,
        status: canceled ? (readsAfterCancel++ === 0 ? "pending_cancel" : "filled") : "new",
        filled_qty: readsAfterCancel > 1 ? "2" : "0",
      }),
    );
  };
}
