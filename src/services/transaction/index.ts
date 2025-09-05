import { prisma } from "../prisma";

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

    async getFinancialStats({ userId = undefined }: { userId?: number } = {}) {
        const extraQuery = userId != null ? `WHERE user_id = ${userId}` : "";
        const result = await prisma.$queryRawUnsafe<
            {
                swap_extracted_volume: number;
                swap_injected_volume: number;
                total_liquidity_provision: number;
                total_extracted_liquidity: number;
            }[]
        >(`
          SELECT
            COALESCE(SUM(
              CASE 
                WHEN type = 'SWAP' AND token0_amount < 0 THEN -token0_amount ELSE 0 END
              +
              CASE 
                WHEN type = 'SWAP' AND token1_amount < 0 THEN -token1_amount ELSE 0 END
            ), 0) AS swap_extracted_volume,
        
            COALESCE(SUM(
              CASE 
                WHEN type = 'SWAP' AND token0_amount > 0 THEN token0_amount ELSE 0 END
              +
              CASE 
                WHEN type = 'SWAP' AND token1_amount > 0 THEN token1_amount ELSE 0 END
            ), 0) AS swap_injected_volume,
        
            COALESCE(SUM(
              CASE 
                WHEN type = 'MINT' THEN ABS(token0_amount) ELSE 0 END
              +
              CASE 
                WHEN type = 'MINT' THEN ABS(token1_amount) ELSE 0 END
            ), 0) AS total_liquidity_provision,
        
            COALESCE(SUM(
              CASE 
                WHEN type = 'BURN' THEN ABS(token0_amount) ELSE 0 END
              +
              CASE 
                WHEN type = 'BURN' THEN ABS(token1_amount) ELSE 0 END
            ), 0) AS total_extracted_liquidity
          FROM "ProcessedTransaction" ${extraQuery};
        `);

        if (!result?.[0]) {
            throw new Error("Failed fetching financial statistics.");
        }
        return {
            swapExtractedVolume: result[0].swap_extracted_volume,
            swapInjectedVolume: result[0].swap_injected_volume,
            totalLiquidityProvision: result[0].total_liquidity_provision,
            totalExtractedLiquidity: result[0].total_extracted_liquidity,
            totalVolume:
                +result[0].swap_extracted_volume +
                +result[0].swap_injected_volume,
        };
    }
}
