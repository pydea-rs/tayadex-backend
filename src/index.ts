import { GetPointBoardRoute, GetPointHistoryRoute, GetQuote, GetSingleUserRoute, GetTaskVerify, GetUserPointHistoryRoute, GetUserPointRoute, GetUsersRoute } from "@/controllers";
import { fromHono } from "chanfana";
import { Hono } from "hono";
// import cron from 'node-cron'; // Commented out for local development - node-cron is not compatible with Cloudflare Workers
import { EventIndexer } from "@/services";

const app = new Hono();

const openapi = fromHono(app, {
  docs_url: "/",
});

openapi.get("/api/tasks/:id", GetTaskVerify);
openapi.get("/api/quote", GetQuote);

openapi.get("api/user", GetUsersRoute);
openapi.get("api/user/:ident", GetSingleUserRoute);
openapi.get("api/user/:id/point", GetUserPointRoute);
openapi.get("api/user/:id/point/history", GetUserPointHistoryRoute);
openapi.get("api/point", GetPointBoardRoute);
openapi.get("api/point/history", GetPointHistoryRoute);

const eventIndexerService = EventIndexer.get();

// Cron job commented out for local development
// node-cron is not compatible with Cloudflare Workers runtime
// For production, consider using Cloudflare Workers scheduled triggers instead
// cron.schedule('*/10 * * * * *', () => {
//   eventIndexerService.listen();
// });

export default app;
