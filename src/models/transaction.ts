import { z } from "zod";

export const ProcessedTransactionSchema = z.object({
    id: z.bigint(),
    hash: z.string(),
    blockId: z.number().int(),
    from: z.string(),
    to: z.string(),
    token0: z.string(),
    token1: z.string().optional().nullable().optional(),
    token0Amount: z.number().int(),
    token1Amount: z.number().int().optional().nullable().optional(),
    type: z.enum(["SWAP"]).default("SWAP"),
    createdAt: z.date().default(() => new Date()),
    processedAt: z.date().optional().nullable().optional(),
    userId: z.number().int().optional().nullable().optional(),
});

export const FinancialStatisticsSchema = z.object({
    swapExtractedVolume: z
        .number()
        .describe(
            "Total amount of tokens user has received from performing swaps"
        ),
    swapInjectedVolume: z
        .number()
        .describe(
            "Total amount of tokens user has entered the pool while swapping"
        ),
    totalLiquidityProvision: z
        .number()
        .describe("Total amount of token user has minted in liquidity pools."),
    totalExtractedLiquidity: z
        .number()
        .describe(
            "Total amount of tokens user has extracted by removing liquidity."
        ),
    totalVolume: z
        .number()
        .describe(
            "Total amount of tokens user has transfered in or out while doing swapps."
        ),
});
