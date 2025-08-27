import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import {
    generateNonce,
    generateAuthMessage,
    verifySignature,
    generateToken,
    Web3AuthSchema,
} from "@/utils/auth";
import type { AppContext } from "@/types";
import { CacheService, ReferralService } from "@/services";
import { UserService } from "@/services/user";

const GetNonceSchema = z.object({
    address: z.string().min(42).max(42).describe("Ethereum wallet address"),
});

const AuthResponseSchema = z.object({
    token: z.string().describe("JWT authentication token"),
    user: z.object({
        id: z.number(),
        address: z.string(),
        name: z.string().nullable(),
        email: z.string().nullable(),
    }),
});

export class GetNonceRoute extends OpenAPIRoute {
    private readonly cacheService = CacheService.getStore();

    schema = {
        request: {
            query: GetNonceSchema,
        },
        responses: {
            200: {
                description: "Get authentication nonce for web3 login",
                content: {
                    "application/json": {
                        schema: z.object({
                            nonce: z.string(),
                            message: z.string(),
                            expiresAt: z.date(),
                        }),
                    },
                },
            },
            400: {
                description: "Invalid address format",
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
            query: { address },
        } = await this.getValidatedData<typeof this.schema>();

        const nonce = generateNonce();

        // TODO: Checkout if the message is based on Ehereum standards.
        const message = generateAuthMessage(address, nonce);

        const { expiresAt } = this.cacheService.put(address, message, {
            expirationTtl: 120,
        });

        return {
            expiresAt,
            nonce,
            message,
        };
    }
}

export class Web3LoginRoute extends OpenAPIRoute {
    private readonly cacheService = CacheService.getStore();
    private readonly userService = UserService.get();
    private readonly referralService = ReferralService.get();

    schema = {
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: Web3AuthSchema,
                    },
                },
            },
        },
        responses: {
            200: {
                description: "Web3 authentication successful",
                content: {
                    "application/json": {
                        schema: AuthResponseSchema,
                    },
                },
            },
            201: {
                description: "User created and authenticated",
                content: {
                    "application/json": {
                        schema: AuthResponseSchema,
                    },
                },
            },
            400: {
                description: "Invalid authentication data",
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

    async handle(ctx: AppContext) {
        const {
            body: {
                address,
                signature,
                message,
                email = null,
                name = null,
                referralCode = null,
            },
        } = await this.getValidatedData<typeof this.schema>();

        if (!message.length || this.cacheService.get(address) !== message) {
            return ctx.json({ error: "Invalid or expired message!" }, 401);
        }
        if (!verifySignature(address, message, signature)) {
            return ctx.json({ error: "Invalid signature" }, 401);
        }

        if (
            referralCode?.length &&
            !(await this.referralService.findUserByReferralCode(referralCode))
        ) {
          return ctx.json({ error: "Invalid referral code!" }, 400);
        }

        const { user, created } =
            await this.userService.findOrCreateUserByAddress(address, {
                ...(email?.length ? { email: email.trim().toLowerCase() } : {}),
                ...(name?.length ? { name } : {}),
            });

        const token = generateToken({
            userId: user.id,
            address: user.address,
        });

        if(created) {
          ctx.status(201);
          if(referralCode?.length) {
            await this.referralService.linkUserToReferrers(user, referralCode, true);
          }
        } else {
          ctx.status(200);
        }

        return {
            token,
            user,
        };
    }
}
