import {
    GetPointBoardRoute,
    GetPointHistoryRoute,
    GetQuote,
    GetSingleUserRoute,
    GetTaskVerify,
    GetUserPointHistoryRoute,
    GetUserPointRoute,
    GetUsersRoute,
    GetProfileRoute,
} from "@/controllers";
import { GetNonceRoute, Web3LoginRoute } from "@/controllers/auth";
import { app, AuthGuard, openapi } from "./utils/setup";

// Authentication routes
openapi.get("/api/auth/nonce", GetNonceRoute);
openapi.post("/api/auth/login", Web3LoginRoute);

// Existing routes
openapi.get("/api/tasks/:id", GetTaskVerify);
openapi.get("/api/quote", GetQuote);

AuthGuard.get("/api/user/profile", GetProfileRoute);
openapi.get("api/user", GetUsersRoute);
openapi.get("api/user/:id/point", GetUserPointRoute);
openapi.get("api/user/:id/point/history", GetUserPointHistoryRoute);
openapi.get("api/user/:ident", GetSingleUserRoute);

openapi.get("api/point", GetPointBoardRoute);
openapi.get("api/point/history", GetPointHistoryRoute);

export default app;
