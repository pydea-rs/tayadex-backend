import {
    PointSources,
    type PointSystemRule,
    PointSystemRuleType,
    type ProcessedTransaction,
    type ReferralRules,
    TransactionType,
    type User,
} from "@prisma/client";
import { prisma } from "../prisma";
import { approximate } from "@/utils";
import { LeaderboardSortOptionsEnum } from "@/models";

export class TransactionsService {
    private static singleInstance: TransactionsService;

    public static get() {
        if (TransactionsService.singleInstance) {
            return TransactionsService.singleInstance;
        }
        return new TransactionsService();
    }

    private constructor() {
        if (TransactionsService.singleInstance) {
            TransactionsService.singleInstance;
        }
        TransactionsService.singleInstance = this;
    }
}
