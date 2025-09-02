import { serve } from '@hono/node-server'
import cron from 'node-cron'
import { CacheService, EventIndexer } from '@/services'
import app from './app'

const port = Number.parseInt(process.env.PORT || '3000', 10)

const eventIndexerService = EventIndexer.get()

// Schedule the cron job to run every 10 seconds
cron.schedule('*/30 * * * * *', () => {
  eventIndexerService.listen().catch(error => {
    console.error('Event indexer failed:', error)
  })
})


const cacheService = CacheService.getStore();

cron.schedule('*/5 * * * *', () => {
  cacheService.cleanup();
})

console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port
}) 