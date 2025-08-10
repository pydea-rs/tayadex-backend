import { prisma } from "../prisma";
import { ReferralService } from "../referral";
import { Address, getAddress, isAddress } from "viem";

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
    }

    async getProfile(
        ident: string,
        {
            publicDataOnly = false,
            throwIfNotFound = true,
        }: { publicDataOnly?: boolean; throwIfNotFound?: boolean } = {}
    ) {
        const isWalletAddress = isAddress(ident);
        if (isNaN(+ident) && !isWalletAddress) {
            throw new Error("Invalid user Id or wallet address!");
        }
        const user = await prisma.user.findUnique({
            where: isWalletAddress ? { address: ident } : { id: +ident },
            select: {
                id: true,
                address: true,
                name: true,
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

    async findOrCreateUserByAddress(
        address: string,
        possibleCreationData: { email?: string; name?: string } = {}
    ) {
        // Normalize the address to checksum format
        const normalizedAddress = getAddress(address);

        try {
            return prisma.user.create({
                data: {
                    address: normalizedAddress,
                    referralCode: await this.referralService.generateNewCode(),
                    ...possibleCreationData,
                },
            });
        } catch (ex) {
            // If creation fails due to unique constraint, find the existing user
            const existingUser = await prisma.user.findFirst({
                where: {
                    address: { equals: normalizedAddress, mode: "insensitive" },
                },
            });

            if (!existingUser) {
                throw ex;
            }
            return existingUser;
        }
    }
}
