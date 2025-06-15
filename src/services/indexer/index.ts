import { Block, TransactionType } from "@prisma/client";
import { tayaswapSubpgrah } from "../graphql/constants";
import { GET_NEW_SWAPS, GET_NEW_LIQUIDITY } from "../graphql/queries";
import { PointService } from "../point";
import { prisma } from "../prisma";
import { INewLiquidityProvisionQueryResult, INewSwapData, INewSwapQueryResult } from "../graphql";

export class EventIndexer {
  private pointService: PointService;

  constructor() {
    this.pointService = new PointService();
  }

  // Main indexing function
  async indexNewEvents() {
    try {
      console.log("Starting event indexing...");

      // Get last processed block
      const lastBlock = await this.getLastProcessedBlock();

      // Index swaps
      await this.indexSwaps(lastBlock);

      // Index liquidity events
      await this.indexLiquidity(lastBlock);

      console.log("Event indexing completed");
    } catch (error) {
      console.error("Error during event indexing:", error);
    }
  }

  // Index new swap events
  private async indexSwaps(lastBlock: bigint) {
    console.log(`Indexing swaps from block ${lastBlock}`);

    const { swaps } = (await tayaswapSubpgrah(GET_NEW_SWAPS, {
      lastBlock: lastBlock.toString(),
    })) as INewSwapQueryResult;

    let maxBlock = lastBlock;

    for (const swap of swaps) {
      try {
        // Check if already processed
        const processed = await this.isTransactionProcessed(
          swap.transaction.id,
          TransactionType.SWAP
        );
        if (processed) continue;

        await this.processSwapEvent(swap);

        const block = await this.saveLastProcessedBlock(
          swap.blockNumber,
          swap.blockHash
        ); // TODO: Do promise.all?
        await this.markTransactionProcessed(
          swap.transaction.id, // id or hash?
          TransactionType.SWAP,
          block
        );
      } catch (error) {
        console.error(`Error processing swap ${swap.id}:`, error);
      }
    }
  }

  // Index new liquidity events
  private async indexLiquidity(lastBlock: bigint) {
    console.log(`Indexing liquidity events from block ${lastBlock}`);

    const { mints, burns } = (await tayaswapSubpgrah(GET_NEW_LIQUIDITY, {
      lastBlock: lastBlock.toString(),
    })) as INewLiquidityProvisionQueryResult;

    let maxBlock = lastBlock;

    // Process mints (add liquidity)
    for (const mint of mints) {
      try {
        const processed = await this.isTransactionProcessed(
          mint.transaction.id,
          "MINT"
        );
        if (processed) continue;

        await this.processMintEvent(mint);
        await this.markTransactionProcessed(
          mint.transaction.id,
          "MINT",
          Number(mint.blockNumber)
        );

        maxBlock = Math.max(maxBlock, Number(mint.blockNumber));
      } catch (error) {
        console.error(`Error processing mint ${mint.id}:`, error);
      }
    }

    // Process burns (remove liquidity)
    for (const burn of burns) {
      try {
        const processed = await this.isTransactionProcessed(
          burn.transaction.id,
          "BURN"
        );
        if (processed) continue;

        await this.processBurnEvent(burn);
        await this.markTransactionProcessed(
          burn.transaction.id,
          "BURN",
          Number(burn.blockNumber)
        );

        maxBlock = Math.max(maxBlock, Number(burn.blockNumber));
      } catch (error) {
        console.error(`Error processing burn ${burn.id}:`, error);
      }
    }
  }

  // Process individual swap event
  private async processSwapEvent(swap: any) {
    const userAddress = swap.from.toLowerCase();

    // Calculate total swap amount in wei
    const amount0In = BigInt(swap.amount0In || 0);
    const amount1In = BigInt(swap.amount1In || 0);
    const totalAmount = amount0In + amount1In;

    // Award points for swap
    await this.pointService.award(
      userAddress,
      totalAmount,
      swap.transaction.id,
      Number(totalAmount)
    );

    console.log(`Awarded points for swap: ${userAddress} - ${totalAmount} wei`);
  }

  // Process mint event (add liquidity)
  private async processMintEvent(mint: any) {
    const userAddress = mint.sender.toLowerCase();

    const amount0 = BigInt(mint.amount0 || 0);
    const amount1 = BigInt(mint.amount1 || 0);
    const totalAmount = amount0 + amount1;

    await this.pointService.award(
      userAddress,
      totalAmount,
      mint.transaction.id,
      Number(totalAmount)
    );

    console.log(
      `Awarded points for liquidity: ${userAddress} - ${totalAmount} wei`
    );
  }

  // Process burn event (remove liquidity)
  private async processBurnEvent(burn: any) {
    const userAddress = burn.sender.toLowerCase();

    const amount0 = BigInt(burn.amount0 || 0);
    const amount1 = BigInt(burn.amount1 || 0);
    const totalAmount = amount0 + amount1;

    await this.pointService.award(
      userAddress,
      totalAmount,
      burn.transaction.id,
      Number(totalAmount)
    );

    console.log(
      `Awarded points for liquidity removal: ${userAddress} - ${totalAmount} wei`
    );
  }

  // Database helper methods
  private async getLastProcessedBlock(): Promise<Block> {
    return prisma.block.findFirst({
      orderBy: { createdAt: "desc" },
    });
  }

  private async saveLastProcessedBlock(
    blockNumber: number | bigint,
    blockHash: string
  ): Promise<Block> {
    return prisma.block.create({
      data: { number: BigInt(blockNumber), hash: blockHash },
    });
  }

  private async isTransactionProcessed(
    txHash: string,
    eventType: TransactionType | string // TODO: Is this required?
  ): Promise<boolean> {
    return prisma.processedTransaction.findFirst({
      where: { hash: txHash, type: eventType as TransactionType },
    });
  }

  private async markTransactionProcessed(
    txHash: string,
    eventType: string | TransactionType,
    blockId: number,
    amount: number,
    from?: string,
    to?: string
  ) {
    let tx = await prisma.processedTransaction.findFirst({
      where: { hash: txHash, type: eventType as TransactionType },
    });

    if (!tx) {
      tx = await prisma.processedTransaction.create({
        data: {
          hash: txHash,
          type: eventType as TransactionType,
          blockId,
          from,
          to,
          amount,
          processedAt: new Date(),
        },
      });
    } else {
      tx.processedAt = new Date();
      await prisma.processedTransaction.update({
        data: tx,
        where: { id: tx.id },
      });
    }
    return tx;
  }
}
