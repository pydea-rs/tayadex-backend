import { PointHistorySchema } from "@/models";
import { PaginationWithOrderSchema } from "@/models/common";
import { PointService } from "@/services";
import type { AppContext } from "@/types";
import { OpenAPIRoute } from "chanfana";
import { z } from "zod";

export class GetPointBoardRoute extends OpenAPIRoute {
    schema = {
        request: {},
        responses: {
            200: {
                description:
                    "Get poinmt board as an object linking users id to their current point value.",
                content: {
                    "application/json": {
                        schema: z.record(z.number(), z.number()),
                    },
                },
            },
        },
    };

    async handle(ctx: AppContext) {
        return PointService.get().getPointBoard();
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
                        schema: PointHistorySchema,
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
            transactionId: point.transactionId.toString(),
            transaction: {
                ...point.transaction,
                id: point.transactionId.toString(),
            },
        }));
    }
}
