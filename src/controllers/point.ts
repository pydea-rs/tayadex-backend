import {
    PointHistoryTableSchema,
    LeaderboardTableSchema,
    GetLeaderboardQuerySchema,
} from "@/models";
import { PaginationWithOrderSchema } from "@/models/common";
import { PointService } from "@/services";
import type { AppContext } from "@/types";
import { OpenAPIRoute } from "chanfana";
import { z } from "zod";

export class GetLeaderBoardRoute extends OpenAPIRoute {
    schema = {
        request: {
            query: GetLeaderboardQuerySchema,
        },
        responses: {
            200: {
                description:
                    "Get leaderboard based on points and different sort options.",
                content: {
                    "application/json": {
                        schema: LeaderboardTableSchema,
                    },
                },
            },
        },
        description: 'Leaderboard endpoint featuring brief point data.',
        tags: ['Point', 'Leaderboard']
    };

    async handle(ctx: AppContext) {
        const { query } = await this.getValidatedData<typeof this.schema>();
        return PointService.get().getLeaderboard(query);
    }
}

export class GetLeaderBoardWithHistoryRoute extends OpenAPIRoute {
    schema = {
        request: {
            query: PaginationWithOrderSchema,
        },
        responses: {
            200: {
                description:
                    "Get leaderboard, sorted by total points, featuring each user's full point history.",
                content: {
                    "application/json": {
                        schema: z.array(z.record(z.string(), z.any())),
                    },
                },
            },
        },
        description: 'Returns the leaderboard, but also the point history of each user in the list (Leaderboard endpoint with full historical data).',
        tags: ['Point', 'Leaderboard']
    };

    async handle(ctx: AppContext) {
        const { query } = await this.getValidatedData<typeof this.schema>();
        return PointService.get().getLeaderboardWithHistory(query);
    }
}

export class GetPointHistoryRoute extends OpenAPIRoute {
    schema = {
        request: {
            query: PaginationWithOrderSchema,
        },
        responses: {
            200: {
                description:
                    "Get all users point history; showing all the points he collected through time by all users.",
                content: {
                    "application/json": {
                        schema: PointHistoryTableSchema,
                    },
                },
            },
        },
        description: 'Get point history of all users so far, showing the flow of point changes in time.',
        tags: ['Point']
    };

    async handle(ctx: AppContext) {
        const {
            query: { take = undefined, skip = undefined, descending = false },
        } = await this.getValidatedData<typeof this.schema>();
        return (
            await PointService.get().getHistory({
                take,
                skip,
                orderDescending: descending,
            })
        ).map((point) => ({
            ...point,
            id: point.id.toString(),
            transactionId: point.transactionId?.toString(),
            transaction: {
                ...point.transaction,
                blockNumber: point.transaction?.blockNumber.toString(),
                id: point.transactionId?.toString(),
            },
        }));
    }
}
