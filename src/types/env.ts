import type { Avatar, User } from "@prisma/client";
import type { Context, ContextVariableMap } from "hono";

export interface Env {
    PORT?: string;
    DATABASE_URL: string;
    JWT_SECRET?: string;
    NODE_ENV?: string;
}

export type AppContext = Context<{ Bindings: Env }>;

export type AuthContext = Context<{
    Variables: {
        user?: User & {
            avatar?: Avatar | null;
        } | null;
    };
}>;
