import {
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
                        ? [trx.token1Amount ?? 0, trx.token0Amount]
                        : [trx.token0Amount, trx.token1Amount ?? 0];
                const point =
                    rule.baseValue + rule.relativeValue / inAmount / outAmount;
                if (!isNaN(point)) {
                    return point;
                }
            case TransactionType.MINT:
            case TransactionType.BURN:
                return (
                    rule.baseValue +
                    rule.relativeValue *
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
                    },
                });
            })
        );
    }
}
