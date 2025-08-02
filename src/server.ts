import { serve } from '@hono/node-server'
import cron from 'node-cron'
import { EventIndexer } from './services'

// Import the app from index.ts
import app from './app'

// Get the port from environment or default to 3000
const port = parseInt(process.env.PORT || '3000', 10)

// Start the cron job for the event indexer
const eventIndexerService = EventIndexer.get()

// Schedule the cron job to run every 10 seconds
cron.schedule('*/10 * * * * *', () => {
  console.log('Running event indexer...')
  eventIndexerService.listen().catch(error => {
    console.error('Event indexer failed:', error)
  })
})

console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port
}) 