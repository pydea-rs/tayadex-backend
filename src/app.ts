import {
    GetLeaderBoardRoute,
    GetPointHistoryRoute,
    GetQuote,
    GetSingleUserRoute,
    GetTaskVerify,
    GetUserPointHistoryRoute,
    GetUserPointRoute,
    GetUsersRoute,
    GetProfileRoute,
    PatchUserRoute,
    GetUserFinancialsStatsRoute,
    GetGeneralFinancialsStatsRoute,
    GetLeaderBoardWithHistoryRoute,
} from "@/controllers";
import { GetNonceRoute, Web3LoginRoute } from "@/controllers/auth";
import { app, AuthGuard, openapi } from "./utils/setup";

openapi.get("/api/auth/nonce", GetNonceRoute);
openapi.post("/api/auth/login", Web3LoginRoute);

openapi.get("/api/tasks/:id", GetTaskVerify);
openapi.get("/api/quote", GetQuote);

AuthGuard.get("/api/user/profile", GetProfileRoute);
openapi.get("api/user", GetUsersRoute);
AuthGuard.patch("/api/user/profile", PatchUserRoute);
openapi.get("api/user/:id/ranking", GetUserPointRoute);
openapi.get("api/user/:id/points", GetUserPointHistoryRoute);
openapi.get("api/user/:id/financials", GetUserFinancialsStatsRoute);
openapi.get("api/user/:ident", GetSingleUserRoute);

openapi.get("api/point/leaderboard", GetLeaderBoardRoute);
openapi.get("api/point/leaderboard/history", GetLeaderBoardWithHistoryRoute);
openapi.get("api/point/history", GetPointHistoryRoute);
openapi.get("api/stats", GetGeneralFinancialsStatsRoute);

export default app;
