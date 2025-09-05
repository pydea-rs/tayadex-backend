import { PointHistoryTableSchema, LeaderboardTableSchema, GetLeaderboardQuerySchema } from "@/models";
import { PaginationWithOrderSchema } from "@/models/common";
import { PointService } from "@/services";
import type { AppContext } from "@/types";
import { OpenAPIRoute } from "chanfana";

export class GetPointBoardRoute extends OpenAPIRoute {
    schema = {
        request: {
            query: GetLeaderboardQuerySchema,
        },
        responses: {
            200: {
                description:
                    "Get poinmt board as an object linking users id to their current point value.",
                content: {
                    "application/json": {
                        schema: LeaderboardTableSchema,
                    },
                },
            },
        },
    };

    async handle(ctx: AppContext) {
        const { query } = await this.getValidatedData<typeof this.schema>();
        return PointService.get().getPointBoard(query);
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
