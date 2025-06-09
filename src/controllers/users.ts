import { CreateUserSchema, UserSchema } from "@/models";
import { PaginationSchema } from "@/models/common";
import { prisma } from "@/services";
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
        // TODO: Add auth
      },
    },
  };

  async handle(ctx: AppContext) {
    const { take = null, skip = null } = (await ctx.req.json()) ?? {};
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
      return prisma.user.create({ data: { address: ident } });
    }
    return user;
  }
}
