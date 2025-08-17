import {
    PointSources,
    PointSystemRule,
    PointSystemRuleType,
    ProcessedTransaction,
    TransactionType,
    User,
} from "@prisma/client";
import { prisma } from "../prisma";

export class PointService {
    private static singleInstance: PointService;

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
            case TransactionType.SWAP:
                const [inAmount, outAmount] =
                    trx.token0Amount < 0
                        ? [trx.token1Amount ?? 0, -trx.token0Amount]
                        : [trx.token0Amount, -(trx.token1Amount ?? 0)];
                const point =
                    rule.baseValue + rule.relativeValue / inAmount / outAmount;
                if (!isNaN(point)) {
                    return point;
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

    async getPointBoard() {
        // Approach 1: Using raw query for better performance with user data
        const results = await prisma.$queryRaw<{
            userId: number;
            totalPoints: number;
            userName: string | null;
            userAddress: string;
            userCreatedAt: Date;
        }[]>`
            SELECT 
                ph."user_id" as "userId",
                SUM(ph.amount) as "totalPoints",
                u.name as "userName",
                u.address as "userAddress",
                u.created_at as "userCreatedAt"
            FROM "PointHistory" ph
            LEFT JOIN "User" u ON ph."user_id" = u.id
            WHERE ph."user_id" IS NOT NULL
            GROUP BY ph."user_id", u.name, u.address, u.created_at
            ORDER BY "totalPoints" DESC
        `;
        return results;
    }

    async getPointBoardWithDetails() {
        // Approach 2: Using groupBy then fetching user details
        const pointSums = await prisma.pointHistory.groupBy({
            by: ["userId"],
            _sum: { amount: true },
            where: { userId: { not: null } },
            orderBy: {
                _sum: {
                    amount: "desc",
                },
            },
        });

        // Get user details for each userId
        const userIds = pointSums.map(p => p.userId).filter(id => id !== null);
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
                id: true,
                name: true,
                address: true,
                createdAt: true,
                // ...
            }
        });

        const userMap = new Map(users.map(user => [user.id, user]));
        return pointSums.map(pointSum => ({
            userId: pointSum.userId,
            totalPoints: pointSum._sum.amount ?? 0,
            user: userMap.get(pointSum.userId!) ?? null,
        }));
    }

    async getPointBoardWithHistory() {
        // Approach 3: Get detailed point history with user and rule info
        const results = await prisma.pointHistory.findMany({
            where: { userId: { not: null } },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        createdAt: true,
                    }
                },
                rule: {
                    select: {
                        id: true,
                        type: true,
                        transactionType: true,
                        baseValue: true,
                        relativeValue: true,
                    }
                },
                transaction: {
                    select: {
                        id: true,
                        hash: true,
                        type: true,
                        token0: true,
                        token1: true,
                        createdAt: true,
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        });

        // Group by user and calculate totals
        const userPointsMap = new Map<number, {
            user: any;
            totalPoints: number;
            pointEntries: any[];
        }>();

        results.forEach(entry => {
            if (!entry.userId) return;
            
            if (!userPointsMap.has(entry.userId)) {
                userPointsMap.set(entry.userId, {
                    user: entry.user,
                    totalPoints: 0,
                    pointEntries: []
                });
            }
            
            const userData = userPointsMap.get(entry.userId)!;
            userData.totalPoints += entry.amount;
            userData.pointEntries.push({
                id: entry.id,
                amount: entry.amount,
                createdAt: entry.createdAt,
                rule: entry.rule,
                transaction: entry.transaction,
            });
        });

        // Convert to array and sort by total points
        return Array.from(userPointsMap.values())
            .sort((a, b) => b.totalPoints - a.totalPoints);
    }

    async getOnesPoint(userId: number) {
        const result = await prisma.pointHistory.aggregate({
            where: { userId },
            _sum: { amount: true },
        });
        return result._sum.amount ?? 0;
    }
}
