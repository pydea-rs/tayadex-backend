import {
    PointSystemRuleType,
    ProcessedTransaction,
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

    getGeneralRule() {
        return prisma.pointSystemRule.findFirst({
            where: { type: PointSystemRuleType.GENERAL },
            orderBy: { id: "desc" },
        }); // TODO: Use Caching here.
    }
    async update(user: User, trx: ProcessedTransaction) {
        const geenralRule = await this.getGeneralRule();

        
    }
}
