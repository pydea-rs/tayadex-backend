import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { prisma } from "@/services/prisma";
import { 
  generateNonce, 
  generateAuthMessage, 
  verifySignature, 
  generateToken,
  Web3AuthSchema 
} from "@/utils/auth";
import { type AppContext } from '@/types';
import { authMiddleware, type AuthContext } from '@/middleware/auth';

// Schema for getting nonce
const GetNonceSchema = z.object({
  address: z.string().min(42).max(42).describe("Ethereum wallet address"),
});

// Schema for authentication response
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
    const { query: { address } } = await this.getValidatedData<typeof this.schema>();
    
    // Generate unique nonce
    const nonce = generateNonce();
    
    // Generate message to sign
    const message = generateAuthMessage(address, nonce);
    
    // TODO: Store nonce in database or cache (for production, use Redis)
    // For now, we'll just return it (in production, store with expiration)
    
    return {
      nonce,
      message,
    };
  }
}

export class Web3LoginRoute extends OpenAPIRoute {
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
    const { body: { address, signature, message, email = null } } = await this.getValidatedData<typeof this.schema>();
    
    if (!verifySignature(address, message, signature)) { 
      return ctx.json({ error: "Invalid signature" }, 401);
    }
    
    let user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() },
    });
    
    if (!user) {
      // Create new user
      user = await prisma.user.create({
        data: {
          address: address.toLowerCase(),
          referralCode: generateReferralCode(),
          ...(email?.length ? { email } : {})
        },
      });
    }
    
    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      address: user.address,
    });
    
    return {
      token,
      user: {
        id: user.id,
        address: user.address,
        name: user.name,
        email: user.email,
      },
    };
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
    // Apply authentication middleware
    await authMiddleware(ctx, async () => {});
    
    if (!ctx.user) {
      return ctx.json({ error: "User not authenticated" }, 401);
    }

    // Get full user profile
    const user = await prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        address: true,
        name: true,
        email: true,
        referralCode: true,
        createdAt: true,
      },
    });

    if (!user) {
      return ctx.json({ error: "User not found" }, 401);
    }

    return user;
  }
}

// Helper function to generate referral code
function generateReferralCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
} 