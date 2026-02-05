// Vercel Serverless Function entrypoint for `/api`
import { handle } from "@hono/node-server/vercel";
import { app } from "../packages/screener/dist/app.js";

export default handle(app);

