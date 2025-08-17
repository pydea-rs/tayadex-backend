# Tayaswap Backend

## TODO
 * Restructure project to be more modular [DONE]
 * Remove unnecessary parts. [DONE]
 * Optimize some operations and queries. [DONE]


## NOTES:
 * Which one is performance-wise better? using viem for indexing or ethers.js itself?
 * R&D On other things to improve indexer.
 * Crteate a failedTx array to handle them in a separate retryFailedTx function.
 * Load All Pairs and Tokens data at startup and then just index trsx?