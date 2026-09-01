// Vercel uses the Corepack-pinned pnpm 12 toolchain for this workspace.
/**
 * Stock Screener API
 *
 * REST API for screening stocks based on technical and fundamental criteria.
 */

import { serve } from "@hono/node-server";
import { app } from "./app.js";

const PORT = parseInt(process.env.PORT || "3000");

console.log(`Starting screener API on port ${PORT}...`);

serve({
  fetch: app.fetch,
  port: PORT,
});

console.log(`Screener API running at http://localhost:${PORT}/api`);
