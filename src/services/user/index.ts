import { prisma } from "../prisma";
import { ReferralService } from "../referral";
import { getAddress } from "viem";

export class UserService {
    private static singleInstance: UserService;

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

    // async findOrCreateUserByAddress(address: string) {
    //     // Normalize the address to checksum format to ensure consistency
    //     const normalizedAddress = getAddress(address);

    //     // Use a transaction to handle potential race conditions
    //     return await prisma.$transaction(async (tx) => {
    //         // First try to find existing user with case-insensitive search
    //         const user = await tx.user.findFirst({
    //             where: { address: { equals: normalizedAddress, mode: "insensitive" } },
    //         });

    //         if (user) {
    //             return user;
    //         }

    //         // If no user found, try to create with normalized address
    //         try {
    //             return await tx.user.create({
    //                 data: {
    //                     address: normalizedAddress,
    //                     referralCode: await ReferralService.get().generateNewCode(),
    //                 },
    //             });
    //         } catch (error) {
    //             // If creation fails due to unique constraint, try finding again
    //             // This handles race conditions where another process created the user
    //             if (error instanceof Error && 'code' in error && error.code === 'P2002' &&
    //                 'meta' in error && typeof error.meta === 'object' && error.meta !== null &&
    //                 'target' in error.meta && Array.isArray(error.meta.target) &&
    //                 error.meta.target.includes('address')) {
    //                 const existingUser = await tx.user.findFirst({
    //                     where: { address: { equals: normalizedAddress, mode: "insensitive" } },
    //                 });
    //                 if (existingUser) {
    //                     return existingUser;
    //                 }
    //             }
    //             throw error;
    //         }
    //     });
    // }
    async findOrCreateUserByAddress(address: string) {
        // Normalize the address to checksum format
        const normalizedAddress = getAddress(address);
        
        try {
            return await prisma.user.create({
                data: {
                    address: normalizedAddress,
                    referralCode: await ReferralService.get().generateNewCode(),
                },
            });
        } catch (ex) {
            // If creation fails due to unique constraint, find the existing user
            const existingUser = await prisma.user.findFirst({
                where: { address: { equals: normalizedAddress, mode: "insensitive" } },
            });
            
            if (!existingUser) {
                // This shouldn't happen, but if it does, throw the original error
                throw ex;
            }
            
            return existingUser;
        }
    }
}
