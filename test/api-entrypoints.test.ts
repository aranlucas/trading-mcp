import { createServer, request, type Server } from "node:http";
import { once } from "node:events";
import { describe, expect, it } from "vitest";
import rootHandler from "@api/index.js";
import rootCatchAllHandler from "@api/[...path].js";
import workspaceHandler from "@/screener/api/index.js";
import workspaceCatchAllHandler from "@/screener/api/[...path].js";

type Handler = typeof rootHandler;

interface ApiResponse {
  status: number | undefined;
  body: string;
}

async function startServer(handler: Handler): Promise<Server> {
  const server = createServer((incoming, outgoing) => {
    void handler(incoming, outgoing).catch(() => {
      outgoing.statusCode = 500;
      outgoing.end("Handler failed");
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  return server;
}

function getStatus(server: Server): Promise<ApiResponse> {
  const address = server.address();

  if (!address || typeof address === "string") throw new Error("Expected a TCP listener");

  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port: address.port, path: "/api" }, (res) => {
      res.setEncoding("utf8");
      let body = "";
      res.on("data", (chunk: string) => {
        body += chunk;
      });
      res.on("end", () => {
        resolve({ status: res.statusCode, body });
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end();
  });
}

function stopServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

describe("Node serverless entrypoints", () => {
  it.each([
    ["root index", rootHandler],
    ["root catch-all", rootCatchAllHandler],
    ["workspace index", workspaceHandler],
    ["workspace catch-all", workspaceCatchAllHandler],
  ] as const)("serves the offline status route through %s", async (_name, handler) => {
    const server = await startServer(handler);
    try {
      const response = await getStatus(server);
      expect(response.status).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        name: "trading-screener",
        version: "0.1.0",
        status: "ok",
      });
    } finally {
      await stopServer(server);
    }
  });
});
