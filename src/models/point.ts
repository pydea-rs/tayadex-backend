import { z } from "zod";
import { PublicUserSchema } from "./user";
import { ProcessedTransactionSchema } from "./transaction";

export const PointHistorySchema = z.object({
    id: z.bigint(),
    userId: z.number(),
    user: PublicUserSchema,
    amount: z.number(),
    createdAt: z.date(),
    updatedAt: z.date(),
    ruleId: z.number(),
    transaction: ProcessedTransactionSchema,
});

export const CreatePointHistorySchema = PointHistorySchema.omit({ id: true });
