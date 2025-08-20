import { PointService, prisma } from "@/services";
import { approximate } from "@/utils";
import {
    PointSources,
    ReferralCriteriaModes,
    ReferralRewardType,
    ReferralRules,
    User,
} from "@prisma/client";

export class ReferralService {
    private static singleInstance: ReferralService;
    private readonly pointService = PointService.get();

    public static get() {
        if (ReferralService.singleInstance) {
            return ReferralService.singleInstance;
        }
        return new ReferralService();
    }

    private constructor() {
        if (ReferralService.singleInstance) {
            ReferralService.singleInstance;
        }
    }
    async findUserByReferralCode(code: string) {
        return prisma.user.findFirst({
            where: { referralCode: code },
        });
    }

    async validateUserAllowanceToSetReferrerCode(
        user: User,
        checkDate: boolean = false
    ) {
        if (checkDate) {
            // In case this is called from some endpoint other than register!
            const deadlineInMinutes = 10; // TODO: Use configService.

            if (
                Date.now() - new Date(user.createdAt).getTime() >=
                deadlineInMinutes * 60000
            ) {
                throw new Error(
                    "Specifying Referral code is only allowed for new users!"
                );
            }
        }
        if (
            await prisma.referral.findFirst({
                where: { OR: [{ userId: user.id }, { referrerId: user.id }] },
            })
        ) {
            throw new Error(
                "You're not allowed to set referrer code, since you already have referral hierarchy!"
            );
        }
        return user;
    }

    async findDirectReferralRelations(options?: {
        relations?: Record<string, boolean | object>;
        onlyForUserId?: number;
    }) {
        if (options?.onlyForUserId != null) {
            return prisma.referral.findMany({
                where: { layer: 0, userId: options.onlyForUserId },
                take: 1,
                ...(options.relations ? { include: options?.relations } : {}),
            });
        }

        return prisma.referral.findMany({
            where: { layer: 0 },
            ...(options?.relations ? { include: options?.relations } : {}),
        });
    }

    async findRefereesHierarchy(userId: number) {
        return prisma.referral.findMany({
            where: { userId },
        });
    }

    async findReferrer(userId: number, shouldThrow: boolean = false) {
        const referral = await prisma.referral.findFirst({
            where: { userId, layer: 0 },
            include: { referrer: true },
        });
        if (!referral) {
            if (shouldThrow) {
                throw new Error("User is not referred by anyone.");
            }
            return null;
        }
        return referral.referrer;
    }

    async findReferees(
        referrerId: number,
        referralType?: {
            layer?: number | Record<string, number>;
            direct?: boolean;
        },
        paginationOptions?: { take?: number; skip?: number }
    ) {
        if (
            referralType &&
            referralType.layer == null &&
            referralType.direct != null
        ) {
            referralType.layer = referralType.direct ? 0 : { not: 0 };
        }

        if (!paginationOptions?.take && !paginationOptions?.skip) {
            const referrals = await prisma.referral.findMany({
                where: {
                    referrerId,
                    ...(referralType?.layer != null
                        ? { layer: referralType.layer }
                        : {}),
                },
                include: { user: true },
            });
            return {
                users: referrals.map((ref) => ref.user),
                count: referrals.length,
            };
        }

        const [referrals, count] = await Promise.all([
            prisma.referral.findMany({
                where: {
                    referrerId,
                    ...(referralType?.layer
                        ? { layer: referralType.layer }
                        : {}),
                },
                include: { user: true },
                ...(paginationOptions?.take
                    ? { take: +paginationOptions.take }
                    : {}),
                ...(paginationOptions?.skip
                    ? { skip: +paginationOptions.skip }
                    : {}),
            }),
            prisma.referral.count({
                where: {
                    referrerId,
                    ...(referralType?.layer
                        ? { layer: referralType.layer }
                        : {}),
                },
            }),
        ]);

        return { users: referrals.map((referral) => referral.user), count };
    }

    async generateNewCode() {
        const codeLength = 8, // TODO: Use configService
            containsAlpha = true; // TODO:

        const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const characters =
            (containsAlpha ? alpha : "") + "01234567890123456789";

        let code: string;
        do {
            code = containsAlpha
                ? alpha[(Math.random() * alpha.length) | 0]
                : "";
            for (let i = code.length; i < codeLength; i++) {
                code += characters[(Math.random() * characters.length) | 0];
            }
        } while (await this.findUserByReferralCode(code));
        return code;
    }

    async getUserReferralsReport(
        userId: number,
        paginationOptions?: { take?: number; skip?: number }
    ) {
        const referrer = await this.findReferrer(userId);

        const directReferralReports = await this.findReferees(
                userId,
                { direct: true },
                paginationOptions
            ),
            indirectReferralReports = await this.findReferees(
                userId,
                { direct: false },
                paginationOptions
            );

        return {
            referrer,
            directs: directReferralReports.users,
            totalDirects: directReferralReports.count,
            indirects: indirectReferralReports.users,
            totalIndirects: indirectReferralReports.count,
        };
    }

    async linkUserToReferrers(
        user: User,
        referrerCode: string,
        shouldThrow: boolean = true
    ) {
        referrerCode = referrerCode.toUpperCase();

        const referrer = await this.findUserByReferralCode(referrerCode);

        if (!referrer || referrerCode === user.referralCode) {
            if (shouldThrow) {
                throw new Error("Invalid referral code!");
            }
            return null;
        }

        try {
            const referrerRelations = await this.findRefereesHierarchy(
                referrer.id
            );
            return prisma.referral.createMany({
                data: [
                    {
                        referrerId: referrer.id,
                        userId: user.id,
                        layer: 0,
                    },
                    ...referrerRelations.map((parentRef) => ({
                        referrerId: parentRef.referrerId,
                        userId: user.id,
                        layer: parentRef.layer + 1,
                    })),
                ],
            });
        } catch (ex) {
            console.error(
                "Linking user to referrers interrupted!",
                ex as Error,
                {
                    data: {
                        userId: user.id,
                        ...(referrer
                            ? {
                                  referrer: {
                                      name: referrer.name,
                                      id: referrer.id,
                                      code: referrer.referralCode,
                                  },
                              }
                            : {}),
                    },
                }
            );
            if (shouldThrow) {
                throw new Error(
                    "It seems that our referral service is not available."
                );
            }
        }
        return null;
    }

    async organizeReferralRelationsByReferrer(
        where: Record<string, unknown> = {}
    ) {
        const relations = await prisma.referral.findMany({
            where,
            include: { referrer: true },
            orderBy: { layer: "asc" },
        });
        const referrers: Record<
            string,
            { referrer: User; referees: number[] }
        > = {};

        for (const ref of relations) {
            if (!referrers[ref.referrer.id]) {
                referrers[ref.referrer.id] = {
                    referrer: ref.referrer,
                    referees: [ref.userId],
                };
            } else {
                referrers[ref.referrer.id].referees.push(ref.userId);
            }
        }
        return referrers;
    }

    async calculateRefereesEfforts(
        referrerId: number,
        referees: number[],
        rules: ReferralRules,
        until: Date = new Date(),
        {
            fromScratch = false,
            bypassLayerEffect = false,
        }: { fromScratch?: boolean; bypassLayerEffect?: boolean } = {}
    ) {
        if (!referees?.length) {
            return 0;
        }
        switch (rules.criteria) {
            case ReferralCriteriaModes.POINTS: {
                if (!bypassLayerEffect && rules.devidByLayer) {
                    const inPsqlArray =
                        referees.length > 1
                            ? `ANY(ARRAY[${referees.join(", ")}])`
                            : referees[0].toString();
                    const extraCondition = !fromScratch
                        ? `AND ph."created_at" > ${rules.lastPaymentAt}`
                        : "";

                    const results = await prisma.$queryRaw<
                        Array<{
                            totalPoints: number;
                        }>
                    >`
                        SELECT SUM(ph."amount" / (rf."layer" + 1)) as "totalPoints"
                        FROM "PointHistory" ph
                        INNER JOIN "Referral" rf ON ph."user_id" = rf."user_id" 
                            AND rf."referrer_id" = ${referrerId}
                        WHERE ph."user_id" = ${inPsqlArray} 
                            AND ph."created_at" <= ${until} 
                            ${extraCondition}
                    `;
                    return results?.[0]?.totalPoints ?? 0;
                } else {
                    const inPsqlArray =
                        referees.length > 1
                            ? `ANY(ARRAY[${referees.join(", ")}])`
                            : referees[0].toString();
                    const extraCondition = !fromScratch
                        ? `AND ph."created_at" > ${rules.lastPaymentAt}`
                        : "";

                    const results = await prisma.$queryRaw<
                        Array<{
                            totalPoints: number;
                        }>
                    >`
                        SELECT SUM(ph."amount") as "totalPoints"
                        FROM "PointHistory" ph
                        WHERE ph."user_id" = ${inPsqlArray} 
                            AND ph."created_at" <= ${until} 
                            ${extraCondition}
                    `;
                    return results?.[0]?.totalPoints ?? 0;
                }
            }
            case ReferralCriteriaModes.TRANSACTIONS:
            // TODO:
            case ReferralCriteriaModes.MINTS_ONLY:
            // TODO:
            case ReferralCriteriaModes.SWAPS_ONLY:
                // TODO:
                break;
        }
        throw new Error("This operation is not implemented yet!");
    }

    async rewardUserByRule(
        links: {
            referrer: User;
            referees: number[];
        },
        rules: ReferralRules,
        untilDate: Date = new Date(),
        direct: boolean = true
    ) {
        const refereesEfforts = await this.calculateRefereesEfforts(
            links.referrer.id,
            links.referees,
            rules,
            untilDate,
            { bypassLayerEffect: direct }
        );

        switch (direct ? rules.directRewardType : rules.indirectRewardType) {
            case ReferralRewardType.POINT:
                await this.pointService.giveReferralPoint(
                    links,
                    rules,
                    direct,
                    refereesEfforts,
                    { untilDate }
                );
                break;
            case ReferralRewardType.MON:
            // TODO:
            default:
                throw new Error("Not implemented yet!");
        }
    }

    async distributeReferrals() {
        const until = new Date();
        // TODO: Make the lastPaymentAt field per user; So if one user's payment failed at one round, it would be paid at next round at least.
        const [directLinks, indirectLinks, allRules] = await Promise.all([
            this.organizeReferralRelationsByReferrer({
                layer: 0,
            }),
            this.organizeReferralRelationsByReferrer({
                layer: { gt: 0 },
            }),
            prisma.referralRules.findMany({
                where: { lastPaymentAt: { lt: until } },
            }),
        ]);

        for (const rules of allRules) {
            if (rules.directRewardRatio > 0) {
                await Promise.all(
                    Object.values(directLinks).map(async (link) => {
                        try {
                            await this.rewardUserByRule(
                                link,
                                rules,
                                until,
                                true
                            );
                        } catch (ex) {
                            console.error(
                                "Failed to pay user referrals direct share.",
                                ex as Error,
                                {
                                    data: {
                                        referees: link?.referees,
                                        referrerId: link?.referrer.id,
                                        trewardTypeype: rules.directRewardType,
                                        ratio: rules.directRewardRatio,
                                        type: "Direct",
                                    },
                                }
                            );
                        }
                    })
                );
            }

            if (rules.indirectRewardRatio) {
                await Promise.all(
                    Object.values(indirectLinks).map(async (link) => {
                        try {
                            await this.rewardUserByRule(
                                link,
                                rules,
                                until,
                                false
                            );
                        } catch (ex) {
                            console.error(
                                "Failed to pay user referrals indirect share.",
                                ex as Error,
                                {
                                    data: {
                                        referees: link.referees,
                                        referrerId: link.referrer.id,
                                        rewardType: rules.indirectRewardType,
                                        ratio: rules.indirectRewardRatio,
                                        type: "Indirect",
                                    },
                                }
                            );
                        }
                    })
                );
            }

            rules.lastPaymentAt = until;
            await prisma.referralRules.update({
                where: { id: rules.id },
                data: rules,
            });
        }

        console.debug(`All referrals rewards until ${until.toLocaleString()} were distributed successfully.`);
    }
}
