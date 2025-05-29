import type { Context } from 'hono'

export interface IEnv {
  CACHE: KVNamespace
}

export type AppContext = Context<{ Bindings: IEnv }>
