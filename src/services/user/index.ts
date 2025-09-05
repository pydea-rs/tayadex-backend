import type { Avatar, User } from "@prisma/client";
import { prisma } from "../prisma";
import { ReferralService } from "../referral";
import { getAddress, isAddress } from "viem";

export class UserService {
    private static singleInstance: UserService;
    private readonly referralService = ReferralService.get();

    public static get() {
        if (UserService.singleInstance) {
            return UserService.singleInstance;
        }
        return new UserService();
    }

    private constructor() {
        if (UserService.singleInstance) {
            UserService.singleInstance;
        }
        UserService.singleInstance = this;
    }

    async getProfile(
        ident: string,
        {
            publicDataOnly = false,
            throwIfNotFound = true,
        }: { publicDataOnly?: boolean; throwIfNotFound?: boolean } = {}
    ) {
        const isWalletAddress = isAddress(ident);
        if (Number.isNaN(+ident) && !isWalletAddress) {
            throw new Error("Invalid user Id or wallet address!");
        }
        const user = await prisma.user.findUnique({
            where: isWalletAddress ? { address: ident } : { id: +ident },
            select: {
                id: true,
                address: true,
                name: true,
                avatar: true,
                ...(!publicDataOnly ? { email: true, referralCode: true } : {}),
                createdAt: true,
            },
        });

        if (!user && throwIfNotFound) {
            throw new Error("User not found!");
        }
        return user;
    }

    findOne(id: number, include: Record<string, boolean>) {
        return prisma.user.findUnique({
            where: { id },
            ...(Object.keys(include ?? {})?.length ? { include } : {}),
        });
    }

    findMany({
        take = undefined,
        skip = undefined,
        publicDataOnly = true,
    }: {
        take?: number;
        skip?: number;
        publicDataOnly?: boolean;
    }) {
        return prisma.user.findMany({
            ...(publicDataOnly
                ? {
                      select: {
                          id: true,
                          address: true,
                          name: true,
                          avatar: true,
                          createdAt: true,
                      },
                  }
                : {}),
            ...(skip ? { skip } : {}),
            ...(take ? { take } : {}),
        });
    }

    async getRandomAvatar() {
        const avatars = await prisma.avatar.findMany();
        if (!avatars.length) {
            return null;
        }
        return avatars[(Math.random() * avatars.length) | 0];
    }

    updateUser({ id, avatar, ...user }: User & { avatar?: Avatar | null }) {
        return prisma.user.update({ where: { id }, data: user });
    }

    async findOrCreateUserByAddress(
        address: string,
        possibleCreationData: { email?: string; name?: string } = {}
    ) {
        const normalizedAddress = getAddress(address);
        try {
            const [referralCode, avatar] = await Promise.all([
                this.referralService.generateNewCode(),
                this.getRandomAvatar(),
            ]);
            return {
                created: true,
                user: await prisma.user.create({
                    data: {
                        address: normalizedAddress,
                        referralCode,
                        ...(avatar ? { avatarId: avatar.id } : {}),
                        ...possibleCreationData,
                    },
                }),
            };
        } catch (ex) {
            // If creation fails due to unique constraint, find the existing user
            const user = await prisma.user.findFirst({
                where: {
                    address: { equals: normalizedAddress, mode: "insensitive" },
                },
            });
            if (!user) {
                throw new Error("User not found!");
            }
            return { user, created: false };
        }
    }
}
