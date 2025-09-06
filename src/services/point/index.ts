import {
    PointSources,
    type PointSystemRule,
    PointSystemRuleType,
    Prisma,
    type ProcessedTransaction,
    type ReferralRules,
    TransactionType,
    type User,
} from "@prisma/client";
import { prisma } from "../prisma";
import { approximate } from "@/utils";
import { LeaderboardSortOptionsEnum } from "@/models";

export class PointService {
    private static singleInstance: PointService;
    private readonly LEADERBOARD_BASE_QUERY = Prisma.sql`SELECT 
                ph."user_id" as "userId",
                u.name as "userName",
                u.address as "userAddress",
                u.created_at as "userCreatedAt",
                SUM(ph.amount) as "totalPoints",
                SUM(CASE WHEN ph.source IN (${PointSources.DIRECT_REFERRAL}::"PointSources", ${PointSources.INDIRECT_REFERRAL}::"PointSources") 
                    THEN ph.amount ELSE 0 END) as "referrals",
                SUM(CASE WHEN ph.source IN (${PointSources.SOCIAL_ACTIVITY}::"PointSources", ${PointSources.ONCHAIN_ACTIVITY}::"PointSources") 
                    THEN ph.amount ELSE 0 END) as "quests"
            FROM "PointHistory" ph
            LEFT JOIN "User" u ON ph."user_id" = u.id`;

    public static get() {
        if (PointService.singleInstance) {
            return PointService.singleInstance;
        }
        return new PointService();
    }

    private constructor() {
        if (PointService.singleInstance) {
            PointService.singleInstance;
        }
        PointService.singleInstance = this;
    }

    getGeneralRule(transactionType: TransactionType) {
        return prisma.pointSystemRule.findFirst({
            where: { type: PointSystemRuleType.GENERAL, transactionType },
            orderBy: { id: "desc" },
        }); // TODO: Use Caching here.
    }

    getEventRules(transactionType: TransactionType, relatedTokens: string[]) {
        return prisma.pointSystemRule.findMany({
            where: {
                type: PointSystemRuleType.EVENT,
                transactionType,
                OR: [
                    {
                        token0: {
                            in: relatedTokens,
                            mode: "insensitive",
                        },
                    },
                    {
                        token1: {
                            in: relatedTokens,
                            mode: "insensitive",
                        },
                    },
                ],
            },
        }); // TODO: Use Caching here.
    }

    calculatePoint(trx: ProcessedTransaction, rule: PointSystemRule) {
        // TODO: Formula used here (esp. min and burn) is a test formula; It needs to be finalized.
        switch (rule.transactionType) {
            case TransactionType.SWAP: {
                const [inAmount, outAmount] =
                    trx.token0Amount < 0
                        ? [trx.token1Amount ?? 0, -trx.token0Amount]
                        : [trx.token0Amount, -(trx.token1Amount ?? 0)];
                const point =
                    rule.baseValue + rule.relativeValue / inAmount / outAmount;
                if (!Number.isNaN(point)) {
                    return point;
                }
            }
            case TransactionType.MINT:
            case TransactionType.BURN:
                return (
                    rule.baseValue +
                    rule.relativeValue * // relativeValue must be positive
                        (trx.token0Amount + (trx.token1Amount ?? 0))
                );
        }
        return 0;
    }

    async update(user: User, trx: ProcessedTransaction) {
        const generalRule = await this.getGeneralRule(trx.type);
        if (generalRule) {
            const point = this.calculatePoint(trx, generalRule);
            await prisma.pointHistory.create({
                data: {
                    amount: point,
                    ruleId: generalRule.id,
                    userId: user.id,
                    transactionId: trx.id,
                    source: PointSources.TRANSACTION,
                },
            });
        }

        const eventRules = await this.getEventRules(
            trx.type,
            [trx.token0, trx.token1].filter((x) => x != null)
        );
        if (!eventRules?.length) {
            return;
        }

        await Promise.all(
            eventRules.map((rule) => {
                const point = this.calculatePoint(trx, rule);
                return prisma.pointHistory.create({
                    data: {
                        amount: point,
                        ruleId: rule.id,
                        userId: user.id,
                        transactionId: trx.id,
                        source: PointSources.TRANSACTION,
                    },
                });
            })
        );
    }

    giveReferralPoint(
        links: { referrer: User; referees: number[] },
        rules: ReferralRules,
        direct: boolean,
        refereesEfforts: number,
        extraData: Record<string, unknown>
    ) {
        const [actualReward, pointSource] = direct
            ? [
                  refereesEfforts * rules.directRewardRatio,
                  PointSources.DIRECT_REFERRAL,
              ]
            : [
                  refereesEfforts * rules.indirectRewardRatio,
                  PointSources.INDIRECT_REFERRAL,
              ];

        return prisma.pointHistory.create({
            data: {
                amount: approximate(actualReward, "ceil", 2),
                source: pointSource,
                userId: links.referrer.id,
                metadata: {
                    refereesEfforts,
                    referralRulesId: rules.id,
                    fromDate: rules.lastPaymentAt,
                    referees: links.referees,
                    actualReward,
                    ...extraData,
                },
            },
        });
    }

    getHistory({
        take = undefined,
        skip = undefined,
        userId = undefined,
        orderDescending = false,
    }: {
        take?: number;
        skip?: number;
        userId?: number;
        orderDescending?: boolean;
    } = {}) {
        return prisma.pointHistory.findMany({
            ...(userId != null ? { where: { userId } } : {}),
            ...(take != null ? { take } : {}),
            ...(skip != null ? { skip } : {}),
            include: {
                user: {
                    select: {
                        id: true,
                        address: true,
                        name: true,
                    },
                },
                transaction: true,
            },
            orderBy: { createdAt: orderDescending ? "desc" : "asc" },
        });
    }

    getUserHistory(
        userId: number,
        paginationData: {
            take?: number;
            skip?: number;
            userId?: number;
            orderDescending?: boolean;
        } = {}
    ) {
        return this.getHistory({ userId, ...paginationData });
    }

    async getLeaderboard({
        take = undefined,
        skip = undefined,
        sortBy = LeaderboardSortOptionsEnum.BY_TOTAL_POINT,
        descending = true,
    }: {
        take?: number;
        skip?: number;
        sortBy?: LeaderboardSortOptionsEnum | string;
        descending?: boolean;
    } = {}) {
        let extraCommands = Prisma.empty;
        if (take) {
            extraCommands = Prisma.sql` LIMIT ${take}`;
        }
        if (skip) {
            extraCommands = Prisma.sql`${extraCommands} OFFSET ${skip}`;
        }

        const orderBy = {
            [LeaderboardSortOptionsEnum.BY_TOTAL_POINT]: Prisma.sql`"totalPoints"`,
            [LeaderboardSortOptionsEnum.BY_QUESTS]: Prisma.sql`"quests"`,
            [LeaderboardSortOptionsEnum.BY_REFERRALS]: Prisma.sql`"referrals"`,
        }[sortBy];

        const sortMode = descending ? Prisma.sql`DESC` : Prisma.sql`ASC`;

        const results = await prisma.$queryRaw<
            {
                userId: number;
                userName: string | null;
                userAddress: string;
                userCreatedAt: Date;
                totalPoints: number;
                referrals: number;
                quests: number;
            }[]
        >`
            ${this.LEADERBOARD_BASE_QUERY}
            WHERE ph."user_id" IS NOT NULL
            GROUP BY ph."user_id", u.name, u.address, u.created_at
            ORDER BY ${orderBy} ${sortMode}
            ${extraCommands}`; // TODO: Checkout if all these groupBy items are necessary (in this func and also getOnesRanking function)

        return results;
    }

    async getLeaderboardWithUserProfile(
        paginationData: {
            take?: number;
            skip?: number;
            orderDescending?: boolean;
        } = {}
    ) {
        const [pointSums, referralsSum, questsSum] = await Promise.all([
            prisma.pointHistory.groupBy({
                by: ["userId"],
                _sum: { amount: true },
                where: { userId: { not: null } },
                orderBy: {
                    _sum: {
                        amount: paginationData.orderDescending ? "desc" : "asc",
                    },
                },
                ...(paginationData?.take ? { take: +paginationData.take } : {}),
                ...(paginationData?.skip ? { skip: +paginationData.skip } : {}),
            }),
            prisma.pointHistory.groupBy({
                by: ["userId"],
                _sum: { amount: true },
                where: {
                    userId: { not: null },
                    source: {
                        in: [
                            PointSources.DIRECT_REFERRAL,
                            PointSources.INDIRECT_REFERRAL,
                        ],
                    },
                },
            }),
            prisma.pointHistory.groupBy({
                by: ["userId"],
                _sum: { amount: true },
                where: {
                    userId: { not: null },
                    source: {
                        in: [
                            PointSources.SOCIAL_ACTIVITY,
                            PointSources.ONCHAIN_ACTIVITY,
                        ],
                    },
                },
            }),
        ]);

        const userIds = pointSums
            .map((p) => p.userId)
            .filter((id) => id !== null);
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
                id: true,
                name: true,
                address: true,
                createdAt: true,
                avatarId: true,
                avatar: true,
            },
        });

        const userMap = new Map(users.map((user) => [user.id, user])),
            referralsSumMap = new Map(
                referralsSum.map((rs) => [rs.userId, rs._sum])
            ),
            questsSumMap = new Map(questsSum.map((qs) => [qs.userId, qs._sum]));

        return pointSums.map((pointSum) => ({
            totalPoints: pointSum._sum.amount ?? 0,
            quests: questsSumMap.get(pointSum.userId),
            referrals: referralsSumMap.get(pointSum.userId),
            user: userMap.get(pointSum.userId!) ?? null,
        }));
    }

    async getLeaderboardWithHistory(
        paginationData: {
            take?: number;
            skip?: number;
            orderDescending?: boolean;
        } = {}
    ) {
        const results = await prisma.pointHistory.findMany({
            where: { userId: { not: null } },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        createdAt: true,
                    },
                },
                rule: {
                    select: {
                        id: true,
                        type: true,
                        transactionType: true,
                        baseValue: true,
                        relativeValue: true,
                    },
                },
                transaction: {
                    select: {
                        id: true,
                        hash: true,
                        type: true,
                        token0: true,
                        token1: true,
                        createdAt: true,
                        blockNumber: true
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        const userPointsMap = new Map<
            number,
            {
                user: any;
                totalPoints: number;
                pointEntries: {
                    id: bigint | string;
                    amount: number;
                    createdAt: Date;
                    rule: {
                        id: number;
                        type: PointSystemRuleType;
                        transactionType: TransactionType;
                        baseValue: number;
                        relativeValue: number;
                    } | null;
                    transaction: {
                        id?: bigint | string;
                        createdAt: Date;
                        type: TransactionType;
                        token0: string;
                        token1: string | null;
                        hash: string;
                        blockNumber?: bigint | string;
                    } | null;
                }[];
            }
        >();

        results.forEach((entry) => {
            if (!entry.userId) return;

            if (!userPointsMap.has(entry.userId)) {
                userPointsMap.set(entry.userId, {
                    user: entry.user,
                    totalPoints: 0,
                    pointEntries: [],
                });
            }

            const userData = userPointsMap.get(entry.userId)!;
            userData.totalPoints += entry.amount;
            userData.pointEntries.push({
                id: entry.id.toString(),
                amount: entry.amount,
                createdAt: entry.createdAt,
                rule: entry.rule,
                transaction: entry?.transaction
                    ? {
                          ...entry.transaction,
                          id: entry.transactionId?.toString(),
                          blockNumber: entry.transaction.blockNumber?.toString(),
                      }
                    : null,
            });
        });

        const finalResults = Array.from(userPointsMap.values()).sort(
            (a, b) =>
                (b.totalPoints - a.totalPoints) *
                (paginationData?.orderDescending ? 1 : -1)
        );
        if (paginationData.skip) {
            return paginationData.take
                ? finalResults.slice(
                      +paginationData.skip,
                      +paginationData.skip + +paginationData.take
                  )
                : finalResults.slice(+paginationData.skip);
        }
        return !paginationData.take
            ? finalResults
            : finalResults.slice(0, +paginationData.take);
    }

    async getOnesPoint(userId: number) {
        const result = await prisma.pointHistory.aggregate({
            where: { userId },
            _sum: { amount: true },
        });
        return result._sum.amount ?? 0;
    }

    async getOnesRanking(userId: number) {
        const user = await prisma.$queryRaw<
            {
                userId: number;
                userName: string | null;
                userAddress: string;
                userCreatedAt: Date;
                totalPoints: number;
                referrals: number;
                quests: number;
                position: number;
            }[]
        >`WITH user_totals AS (
            ${this.LEADERBOARD_BASE_QUERY}
            WHERE ph."user_id" = ${userId}
            GROUP BY ph."user_id", u.name, u.address, u.created_at
        )
        SELECT 
            ut.*,
            (
                SELECT COUNT(*)::INT
                FROM (
                    SELECT ph2."user_id", SUM(ph2.amount) as totalPoints
                    FROM "PointHistory" ph2
                    GROUP BY ph2."user_id"
                    HAVING SUM(ph2.amount) > ut."totalPoints"
                ) higher
            ) + 1 AS "position"
        FROM user_totals ut;
      `;

        return user?.[0] ?? null;
    }
}
