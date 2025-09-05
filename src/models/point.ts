import { z } from "zod";
import { PublicUserSchema } from "./user";
import { ProcessedTransactionSchema } from "./transaction";
import { PaginationWithOrderSchema } from "./common";

export const PointHistoryItemSchema = z.object({
    id: z.bigint(),
    userId: z.number(),
    user: PublicUserSchema,
    amount: z.number(),
    createdAt: z.date(),
    updatedAt: z.date(),
    ruleId: z.number(),
    transaction: ProcessedTransactionSchema,
});

export const PointHistoryTableSchema = z.array(PointHistoryItemSchema);

export const CreatePointHistorySchema = PointHistoryItemSchema.omit({
    id: true,
});

export const LeaderboardRankingItemSchema = z.object({
    userId: z.number(),
    userName: z.string().nullable(),
    userAddress: z.string(),
    userCreatedAt: z.date(),
    totalPoints: z
        .number()
        .describe("Sum of all points gained by any approach."),
    referrals: z.number().describe("Sum of points gained by referrals."),
    quests: z.number().describe("Sum of points gained by completing quests."),
});

export const LeaderboardRankingItemWithPositionSchema =
    LeaderboardRankingItemSchema.extend({
        position: z
            .number()
            .describe("User's position (ranking) in leaderboard"),
    })
        .nullable()
        .describe("The ranking data of a specific user");
export const LeaderboardTableSchema = z.array(LeaderboardRankingItemSchema);

export enum LeaderboardSortOptionsEnum {
    BY_REFERRALS = "referrals",
    BY_QUESTS = "quests",
    BY_TOTAL_POINT = "total",
}

export const LeaderboardSortOptionsEnumSchema = z.enum(
    Object.values(LeaderboardSortOptionsEnum) as [string, ...string[]]
);

export const GetLeaderboardQuerySchema = PaginationWithOrderSchema.extend({
    sortBy: LeaderboardSortOptionsEnumSchema,
});
