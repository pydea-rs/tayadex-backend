import { PointHistoryTableSchema, UserSchema } from "@/models";
import { PaginationSchema, PaginationWithOrderSchema } from "@/models/common";
import { PointService, ReferralService } from "@/services";
import {
    UserPrivateProfileDto,
    UserPublicProfileDto,
    type AppContext,
} from "@/types";
import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { UserService } from "@/services/user";
import type { AuthContext } from "@/middleware/auth";

export class GetUsersRoute extends OpenAPIRoute {
    private userService = UserService.get();

    schema = {
        request: {
            query: PaginationSchema,
        },
        responses: {
            200: {
                description: "Get users endpoint",
                content: {
                    "application/json": {
                        schema: z.array(UserPublicProfileDto),
                    },
                },
            },
        },
    };

    async handle(ctx: AppContext) {
        const {
            query: { take = undefined, skip = undefined },
        } = await this.getValidatedData<typeof this.schema>();
        return this.userService.findMany({ take, skip, publicDataOnly: true });
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
        } catch (ex) {
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

    async handle(ctx: AppContext) {
        const {
            params: { id },
        } = await this.getValidatedData<typeof this.schema>();

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
                        schema: PointHistoryTableSchema,
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
            transactionId: point.transactionId?.toString(),
            transaction: {
                ...point.transaction,
                id: point.transactionId?.toString(),
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
                        schema: UserPrivateProfileDto,
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
        user.updatedAt = undefined;
        return user;
    }
}

export class PatchUserRoute extends OpenAPIRoute {
    private readonly userService = UserService.get();
    private readonly referralService = ReferralService.get();

    schema = {
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: z.object({
                            email: z.string().email().optional().nullable(),
                            name: z.string().optional().nullable(),
                            referralCode: z.string().optional().nullable(),
                        }),
                    },
                },
            },
        },
        responses: {
            200: {
                description: "User update was successful.",
                content: {
                    "application/json": {
                        schema: UserPrivateProfileDto,
                    },
                },
            },
            400: {
                description: "Invalid update data",
                content: {
                    "application/json": {
                        schema: z.object({
                            error: z.string(),
                        }),
                    },
                },
            },
            401: {
                description: "Authentication failed",
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
        const {
            body: { email = null, name = null, referralCode = null },
        } = await this.getValidatedData<typeof this.schema>();

        const { user } = ctx;
        
        try {
            if(!user) {
                return ctx.json({ error: "Authentication failed." }, 401)
            }
            if (
                (!email?.length ||
                    email.toLowerCase() === user?.email?.toLowerCase()) &&
                (!name?.length || name === user?.name) &&
                !referralCode?.length
            ) {
                throw new Error("Nothing new provided to update!");
            }

            if (referralCode?.length) {
                await this.referralService.validateUserAllowanceToSetReferrerCode(
                    user,
                    true
                );
                await this.referralService.linkUserToReferrers(
                    user,
                    referralCode,
                    true,
                );
            }
            
            if(email?.length) {
                user.email = email.trim().toLowerCase();
            }
            
            if(name?.length) {
                user.name = name;
            }
            
            await this.userService.updateUser(user);
            return user;
        } catch (ex) {
            return ctx.json({ error: (ex as Error).message }, 400);
        }
    }
}
