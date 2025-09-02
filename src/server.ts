import { serve } from "@hono/node-server";
import cron from "node-cron";
import { CacheService, EventIndexer } from "@/services";
import app from "./app";

const port = Number.parseInt(process.env.PORT || "3000", 10);

const eventIndexerService = EventIndexer.get();
const indexerInterval = +(process.env.INDEXER_INTERVAL ?? 0);
if (indexerInterval > 0) {
    // Schedule the cron job to run based on interval
    cron.schedule("*/10 * * * * *", () => {
        eventIndexerService.listen().catch((error) => {
            console.error("Event indexer failed:", error);
        });
    });
}

const cacheService = CacheService.getStore();

cron.schedule("*/5 * * * *", () => {
    console.log('Cleaning up cache for reassurance...')
    cacheService.cleanup();
});

console.log(`Server is running on port ${port}`);

serve({
    fetch: app.fetch,
    port,
});
