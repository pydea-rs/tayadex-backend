import { GetQuote, GetTaskVerify } from '@/handlers'
import { fromHono } from 'chanfana'
import { Hono } from 'hono'

const app = new Hono()

const openapi = fromHono(app, {
  docs_url: '/'
})

openapi.get('/api/tasks/:id', GetTaskVerify)
openapi.get('/api/quote', GetQuote)

export default app
