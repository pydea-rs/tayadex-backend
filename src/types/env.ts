import type { Context } from 'hono'

export interface Env {
  PORT?: string;
  DATABASE_URL: string;
  JWT_SECRET?: string;
  NODE_ENV?: string;
}

export type AppContext = Context<{ Bindings: Env }>
