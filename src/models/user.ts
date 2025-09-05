import { z } from "zod";
import { FinancialStatisticsSchema } from "./transaction";

export const UserSchema = z.object({
    id: z.number(),
    name: z.string().optional(),
    email: z.string().email().optional(),
    address: z.string(),
});

export const CreateUserSchema = UserSchema.omit({ id: true });

export const PublicUserSchema = UserSchema.omit({ email: true });

export const UserPrivateProfileDto = z.object({
    id: z.number(),
    address: z.string(),
    name: z.string().nullable(),
    email: z.string().nullable(),
    referralCode: z.string(),
    createdAt: z.date(),
    avatarId: z.number().nullable(),
    avatar: z
        .object({
            id: z.number(),
            asset: z.string(),
            createdAt: z.date(),
        })
        .nullable(),
});

export const UserPublicProfileDto = UserPrivateProfileDto.omit({
    email: true,
    referralCode: true,
});

export const UserProfileWithFinancialDataSchema = UserPrivateProfileDto.extend({
    financials: FinancialStatisticsSchema,
});
