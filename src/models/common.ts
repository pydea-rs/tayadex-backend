import { z } from "zod";

export const PaginationSchema = z.object({
  take: z.number().optional(),
  skip: z.number().optional(),
});
