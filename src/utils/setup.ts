import { authMiddleware, optionalAuthMiddleware } from "@/middleware";
import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";

export const app = new Hono();

// TODO: Checkout hono logger() middleware
// TODO: User Cloudflare or implement manual rate limit.
app.use("/*", cors());

export const openapi = fromHono(app, {
    docs_url: "/",
});

export type GuardOptions = {
    optionalAuth?: boolean;
};

function authGuardGet(
    path: string,
    handler: any,
    { optionalAuth = false }: GuardOptions = {}
) {
    app.use(path, !optionalAuth ? authMiddleware : optionalAuthMiddleware);
    openapi.get(path, handler);
}

function authGuardPost(
    path: string,
    handler: any,
    { optionalAuth = false }: GuardOptions = {}
) {
    app.use(path, !optionalAuth ? authMiddleware : optionalAuthMiddleware);
    openapi.post(path, handler);
}

function authGuardPut(
    path: string,
    handler: any,
    { optionalAuth = false }: GuardOptions = {}
) {
    app.use(path, !optionalAuth ? authMiddleware : optionalAuthMiddleware);
    openapi.put(path, handler);
}

function authGuardPatch(
    path: string,
    handler: any,
    { optionalAuth = false }: GuardOptions = {}
) {
    app.use(path, !optionalAuth ? authMiddleware : optionalAuthMiddleware);
    openapi.patch(path, handler);
}

function authGuardDelete(
    path: string,
    handler: any,
    { optionalAuth = false }: GuardOptions = {}
) {
    app.use(path, !optionalAuth ? authMiddleware : optionalAuthMiddleware);
    openapi.delete(path, handler);
}

export const AuthGuard = {
  get: authGuardGet,
  post: authGuardPost,
  put: authGuardPut,
  patch: authGuardPatch,
  delete: authGuardDelete,
}