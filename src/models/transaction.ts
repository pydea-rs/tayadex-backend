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