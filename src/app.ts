import { GetPointBoardRoute, GetPointHistoryRoute, GetQuote, GetSingleUserRoute, GetTaskVerify, GetUserPointHistoryRoute, GetUserPointRoute, GetUsersRoute } from "@/controllers";
import { GetNonceRoute, Web3LoginRoute, GetProfileRoute } from "@/controllers/auth";
import { fromHono } from "chanfana";
import { Hono } from "hono";

const app = new Hono();

const openapi = fromHono(app, {
  docs_url: "/",
});

// Authentication routes
openapi.get("/api/auth/nonce", GetNonceRoute);
openapi.post("/api/auth/login", Web3LoginRoute);
openapi.get("/api/auth/profile", GetProfileRoute);

// Existing routes
openapi.get("/api/tasks/:id", GetTaskVerify);
openapi.get("/api/quote", GetQuote);

openapi.get("api/user", GetUsersRoute);
openapi.get("api/user/:ident", GetSingleUserRoute);
openapi.get("api/user/:id/point", GetUserPointRoute);
openapi.get("api/user/:id/point/history", GetUserPointHistoryRoute);
openapi.get("api/point", GetPointBoardRoute);
openapi.get("api/point/history", GetPointHistoryRoute);

export default app;
