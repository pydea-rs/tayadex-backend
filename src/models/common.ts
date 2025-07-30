import { z } from "zod";

export const PaginationSchema = z.object({
  take: z.number().optional(),
  skip: z.number().optional(),
});


export const PaginationWithOrderSchema = z.object({
  take: z.number().optional(),
  skip: z.number().optional(),
  descending: z.boolean().optional(),
});