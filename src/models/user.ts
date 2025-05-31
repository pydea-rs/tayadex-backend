import { z } from "zod";

export const UserSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string(),
});

export const CreateUserSchema = UserSchema.omit({id: true})