// Vercel Serverless Function entrypoint for `/api`
import { handle } from "hono/vercel";
import { app } from "../dist/app.js";

export default handle(app);

