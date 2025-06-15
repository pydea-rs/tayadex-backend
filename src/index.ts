import { GetQuote, GetSingleUserRoute, GetTaskVerify, GetUsersRoute } from "@/controllers";
import { fromHono } from "chanfana";
import { Hono } from "hono";
import cron from 'node-cron';
import { EventIndexer } from "./services/indexer";

const app = new Hono();

const openapi = fromHono(app, {
  docs_url: "/",
});

openapi.get("/api/tasks/:id", GetTaskVerify);
openapi.get("/api/quote", GetQuote);

openapi.get("api/user", GetUsersRoute);
openapi.get("api/user/:ident", GetSingleUserRoute);

const eventIndexerService = EventIndexer.get();

cron.schedule('*/10 * * * * *', () => {
  eventIndexerService.listen();
});

export default app;
