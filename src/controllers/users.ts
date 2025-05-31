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
