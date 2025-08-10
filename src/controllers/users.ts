import { PointHistorySchema, UserSchema } from "@/models";
import { PaginationSchema, PaginationWithOrderSchema } from "@/models/common";
import { prisma, PointService, ReferralService } from "@/services";
import { type AppContext } from "@/types";
import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { UserService } from "@/services/user";
import { authMiddleware, type AuthContext } from "@/middleware/auth";

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
    private userService = UserService.get();

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

        try {

            return this.userService.getProfile(ident, {
                publicDataOnly: true,
                throwIfNotFound: true,
            });
        } catch(ex) {
            return ctx.json({ error: (ex as Error).message }, 400);
        }

    }
}

export class GetUserPointRoute extends OpenAPIRoute {
    private pointService = PointService.get();

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
            401: {
                description: "Unauthorized - Authentication required",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string(),
                        }),
                    },
                },
            },
        },
    };

    async handle(ctx: AuthContext) {
        // Apply authentication middleware
        await authMiddleware(ctx, async () => {});

        const {
            params: { id },
        } = await this.getValidatedData<typeof this.schema>();

        // Optional: Check if user is requesting their own points or has admin access
        if (ctx.user && ctx.user.id !== id) {
            // For now, allow access to any user's points
            // In production, you might want to restrict this
        }

        return this.pointService.getOnesPoint(id);
    }
}

export class GetUserPointHistoryRoute extends OpenAPIRoute {
    private pointService = PointService.get();

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

        return (
            await this.pointService.getUserHistory(id, {
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

export class GetProfileRoute extends OpenAPIRoute {
    schema = {
        responses: {
            200: {
                description: "Get authenticated user profile",
                content: {
                    "application/json": {
                        schema: z.object({
                            id: z.number(),
                            address: z.string(),
                            name: z.string().nullable(),
                            email: z.string().nullable(),
                            referralCode: z.string(),
                            createdAt: z.date(),
                        }),
                    },
                },
            },
            401: {
                description: "Unauthorized - Authentication required",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string(),
                        }),
                    },
                },
            },
        },
    };

    async handle(ctx: AuthContext) {
        const user = { ...ctx.user };
        delete user.updatedAt;
        return user;
    }
}
