// Native runner configuration cannot inject a broker into the stdio child; preload a controlled transport before the real entrypoint.
import { createBrokerTransport } from "./broker-transport.js";

globalThis.fetch = createBrokerTransport();

await import("../dist/index.js");
