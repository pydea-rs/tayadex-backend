import { z } from "zod";

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
