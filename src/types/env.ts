import type { Context } from 'hono'

export interface IEnv {
  // Add any environment variables you need here
  PORT?: string;
  DATABASE_URL?: string;
}

export type AppContext = Context<{ Bindings: IEnv }>
