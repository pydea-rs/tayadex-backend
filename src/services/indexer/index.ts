import { Block, ProcessedTransaction, TransactionType } from "@prisma/client";
import { tayaswapSubpgrah } from "../graphql/constants";
import { GET_NEW_SWAPS, GET_NEW_LIQUIDITY } from "../graphql/queries";
import { PointService } from "../point";
import { prisma } from "../prisma";
import {
  INewLiquidityProvisionQueryResult,
  INewSwapQueryResult,
} from "../graphql";
import { evaluateTokenData, TokensNumericalData } from "@/utils";

export class EventIndexer {
  private static singleInstance: EventIndexer;

  static get() {
    if (EventIndexer.singleInstance) {
      return EventIndexer.singleInstance;
    }
    return new EventIndexer(PointService.get());
  }

  private constructor(private readonly pointService: PointService) {
    if (EventIndexer.singleInstance) {
      return EventIndexer.singleInstance; // Double check re-instanciation block.
    }
  }

  async listen() {
    try {
      const lastBlock = await this.getLastProcessedBlock();
      console.log(
        `Listening for Events, starting from block#${
          lastBlock?.number ?? "ZERO"
        }`
      );

      await Promise.all([
        this.checkoutSwapEvents(lastBlock),
        this.checkoutLiquidityEvents(lastBlock),
      ]);
    } catch (error) {
      console.error("Listener failed on this round:", error);
    }
  }

  public async checkoutSwapEvents(lastBlock: Block | null) {
    console.log(`Indexing swaps from block ${lastBlock}`);

    const latestBlockNumber = lastBlock?.number ?? 0n; // TODO: Decide what to do at indexer start? process from 0, or from latest block at present.
    const { swaps } = (await tayaswapSubpgrah(GET_NEW_SWAPS, {
      lastBlock: latestBlockNumber.toString(),
    })) as INewSwapQueryResult;

    for (const swap of swaps) {
      try {
        const block =
          !lastBlock || lastBlock.number !== swap.blockNumber
            ? await this.saveLastProcessedBlock(swap.blockNumber)
            : lastBlock; // TODO: Do promise.all?
        const { tx, alreadyProcessed } = await this.markTransactionProcessed(
          swap.transaction.id, // TODO: id or hash?
          TransactionType.SWAP,
          block.id,
          [
            {
              symbol: swap.pair.token0.symbol,
              decimals: swap.pair.token0.decimals,
              amount: swap.amount0In - swap.amount0Out,
            },
            {
              symbol: swap.pair.token1.symbol,
              decimals: swap.pair.token1.decimals,
              amount: swap.amount1In - swap.amount1Out,
            },
          ],
          swap.from,
          swap.to
        );
        lastBlock = block;

        // TODO: Update point history...
        if (!alreadyProcessed) {
          await this.processNewSwapEvent(tx);
        }
      } catch (error) {
        console.error(`Error processing swap ${swap.id}:`, error);
      }
    }
  }

  public async checkoutLiquidityEvents(lastBlock: Block | null) {
    console.log(`Indexing liquidity events from block ${lastBlock}`);

    const latestBlockNumber = lastBlock?.number ?? 0n; // TODO: Decide what to do at indexer start? process from 0, or from latest block at present.

    const { mints, burns } = (await tayaswapSubpgrah(GET_NEW_LIQUIDITY, {
      lastBlock: latestBlockNumber.toString(),
    })) as INewLiquidityProvisionQueryResult;

    for (const mint of mints) {
      try {
        const block =
          !lastBlock || lastBlock.number !== mint.blockNumber
            ? await this.saveLastProcessedBlock(mint.blockNumber)
            : lastBlock;

        const { tx, alreadyProcessed } = await this.markTransactionProcessed(
          mint.transaction.id,
          TransactionType.MINT,
          block.id,
          [
            {
              symbol: mint.pair.token0.symbol,
              decimals: mint.pair.token0.decimals,
              amount: mint.amount0,
            },
            {
              symbol: mint.pair.token1.symbol,
              decimals: mint.pair.token1.decimals,
              amount: mint.amount1,
            },
          ],
          mint.sender,
          mint.to
        );

        lastBlock = block;
        if (!alreadyProcessed) {
          await this.processNewLiquidityEvent(tx);
        }
      } catch (error) {
        console.error(`Error processing mint ${mint.id}:`, error);
      }
    }

    for (const burn of burns) {
      try {
        const block =
          !lastBlock || lastBlock.number !== burn.blockNumber
            ? await this.saveLastProcessedBlock(burn.blockNumber)
            : lastBlock;

        const { tx, alreadyProcessed } = await this.markTransactionProcessed(
          burn.transaction.id,
          TransactionType.BURN,
          block.id,
          [
            {
              symbol: burn.pair.token0.symbol,
              decimals: burn.pair.token0.decimals,
              amount: -burn.amount0, // TODO: Checkout the sign of the Burn events amount
            },
            {
              symbol: burn.pair.token1.symbol,
              decimals: burn.pair.token1.decimals,
              amount: -burn.amount1, // TODO: Checkout the sign of the Burn events amount
            },
          ],
          burn.sender,
          burn.to
        );

        lastBlock = block;
        if (!alreadyProcessed) {
          await this.processNewLiquidityEvent(tx);
        }
      } catch (error) {
        console.error(`Error processing burn ${burn.id}:`, error);
      }
    }
  }

  public async processNewSwapEvent(tx: ProcessedTransaction) {
    const user = await prisma.user.findFirst({
      where: { address: { equals: tx.from, mode: "insensitive" } },
    });
    if (!user) {
      return; // Only registered user will be rewarded
      // TODO/ASK: What if user registers later?
    }
    // Award points for swap based on specified rule:
    await Promise.all([
      this.pointService.award(user, tx),
      prisma.processedTransaction.update({
        data: { userId: user.id },
        where: { id: tx.id },
      }), // We save all transactions, but only reward transactions that relate to user table.
    ]);
  }

  public async processNewLiquidityEvent(tx: ProcessedTransaction) {
    const user = await prisma.user.findFirst({
      where: { address: { equals: tx.from, mode: "insensitive" } },
    });
    if (!user) {
      return;
    }

    await Promise.all([
      this.pointService.rewardOrPunish(user, tx),
      prisma.processedTransaction.update({
        data: { userId: user.id },
        where: { id: tx.id },
      }), // We save all transactions, but only reward transactions that relate to user table.
    ]);
  }

  public async getLastProcessedBlock(): Promise<Block | null> {
    return prisma.block.findFirst({
      orderBy: { createdAt: "desc" },
    });
  }

  public async saveLastProcessedBlock(
    blockNumber: number | bigint
  ): Promise<Block> {
    const block = await prisma.block.findFirst({
      where: { number: blockNumber },
    });
    if (block) {
      return block;
    }
    return prisma.block.create({
      data: { number: BigInt(blockNumber) },
    });
  }

  public async isTransactionProcessed(
    txHash: string,
    eventType: TransactionType | string // TODO: Is this required?
  ): Promise<boolean> {
    return Boolean(
      await prisma.processedTransaction.findFirst({
        where: { hash: txHash, type: eventType as TransactionType },
      })
    );
  }

  public async markTransactionProcessed(
    txHash: string,
    eventType: string | TransactionType,
    blockId: number,
    tokensData: TokensNumericalData[],
    from: string,
    to: string
  ) {
    let tx = await prisma.processedTransaction.findFirst({
      where: { hash: txHash, type: eventType as TransactionType },
    });

    if (!tx) {
      const tokens = tokensData.map((tk) => evaluateTokenData(tk));
      tx = await prisma.processedTransaction.create({
        data: {
          hash: txHash,
          type: eventType as TransactionType,
          blockId,
          from,
          to,
          token0: tokens[0].symbol,
          token0Amount: tokens[0].amount,
          token1: tokens[1].symbol,
          token1Amount: tokens[1].amount,
          processedAt: new Date(),
        },
      });
    } else {
      if (tx.processedAt) {
        return { tx, alreadyProcessed: true };
      }
      const tokens = tokensData.map((tk) => evaluateTokenData(tk));
      tx.processedAt = new Date();
      // make sure token data is synced.
      tx.token0 = tokens[0].symbol;
      tx.token0Amount = tokens[0].amount;
      tx.token1 = tokens[1].symbol;
      tx.token1Amount = tokens[1].amount;
      await prisma.processedTransaction.update({
        data: tx,
        where: { id: tx.id },
      });
    }
    return { tx, alreadyProcessed: false };
  }
}
