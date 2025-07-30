import { PointHistorySchema, UserSchema } from "@/models";
import { PaginationSchema, PaginationWithOrderSchema } from "@/models/common";
import { prisma, PointService, ReferralService } from "@/services";
import { AppContext } from "@/types";
import { OpenAPIRoute } from "chanfana";
import { z } from "zod";

export class GetUsersRoute extends OpenAPIRoute {
    schema = {
        request: {
            query: PaginationSchema,
        },
        responses: {
            200: {
                description: "Get users endpoint",
                content: {
                    "application/json": {
                        schema: z.array(UserSchema),
                    },
                },
                // TODO: Add auth after completing referral
            },
        },
    };

    async handle(ctx: AppContext) {
        const {
            query: { take = null, skip = null },
        } = await this.getValidatedData<typeof this.schema>();
        return prisma.user.findMany({
            ...(skip ? { skip } : {}),
            ...(take ? { take } : {}),
        });
    }
}

export class GetSingleUserRoute extends OpenAPIRoute {
    schema = {
        request: {
            params: z.object({
                ident: z.string().describe("User id or wallet address"),
            }),
        },
        responses: {
            200: {
                description: "Get single user endpoint",
                content: {
                    "application/json": {
                        schema: UserSchema,
                    },
                },
            },
        },
    };

    async handle(ctx: AppContext) {
        const {
            params: { ident },
        } = await this.getValidatedData<typeof this.schema>();

        if (!isNaN(+ident)) {
            return prisma.user.findFirstOrThrow({
                where: { id: +ident },
            });
        }
        const user = await prisma.user.findFirst({ where: { address: ident } });
        if (!user) {
            // TODO: check ident being valid address
            return prisma.user.create({
                data: {
                    address: ident,
                    referralCode: await ReferralService.get().generateNewCode(),
                },
            });
        }
        return user;
    }
}

export class GetUserPointRoute extends OpenAPIRoute {
    schema = {
        request: {
            params: z.object({
                id: z.number().describe("User id"),
            }),
        },
        responses: {
            200: {
                description:
                    "Get single user's point endpoint; Returns a value as point.",
                content: {
                    "application/json": {
                        schema: z.number(),
                    },
                },
            },
        },
    };

    async handle(ctx: AppContext) {
        const {
            params: { id },
        } = await this.getValidatedData<typeof this.schema>();

        return PointService.get().getOnesPoint(id);
    }
}

export class GetUserPointHistoryRoute extends OpenAPIRoute {
    schema = {
        request: {
            params: z.object({
                id: z.number().describe("User id"),
            }),
            query: PaginationWithOrderSchema,
        },
        responses: {
            200: {
                description:
                    "Get single user's point history; showing all the points he collected through time.",
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
            params: { id },
            query: { take = undefined, skip = undefined, descending = false },
        } = await this.getValidatedData<typeof this.schema>();

        return PointService.get().getUserHistory(id, {
            take,
            skip,
            orderDescending: descending,
        });
    }
}
