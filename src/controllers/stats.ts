import { FinancialStatisticsSchema } from "@/models";
import { TransactionsService } from "@/services/transaction";
import type { AppContext } from "@/types";
import { OpenAPIRoute } from "chanfana";

export class GetGeneralFinancialsStatsRoute extends OpenAPIRoute {
    private transactionsService = TransactionsService.get();

    schema = {
        responses: {
            200: {
                description:
                    "Get general financial statistics (of all users so far), such as total volume, total liquidity provision (LP), etc.",
                content: {
                    "application/json": {
                        schema: FinancialStatisticsSchema,
                    },
                },
            },
        },
    };

    async handle(ctx: AppContext) {
        return this.transactionsService.getFinancialStats();
    }
}
