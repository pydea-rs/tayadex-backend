import { GetQuote, GetSingleUserRoute, GetTaskVerify, GetUsersRoute } from "@/controllers";
import { fromHono } from "chanfana";
import { Hono } from "hono";

const app = new Hono();

const openapi = fromHono(app, {
  docs_url: "/",
});

openapi.get("/api/tasks/:id", GetTaskVerify);
openapi.get("/api/quote", GetQuote);

openapi.get("api/user", GetUsersRoute);
openapi.get("api/user/:ident", GetSingleUserRoute);
export default app;
