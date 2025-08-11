import { Block, ProcessedTransaction, TransactionType, User } from "@prisma/client";
import { PointService } from "../point";
import { prisma } from "../prisma";
import { BlockchainService, type SwapEvent, type LiquidityEvent } from "../blockchain";
import { evaluateTokenData, TokensNumericalData } from "@/utils";
import { UserService } from "../user";

export class EventIndexer {
  private static singleInstance: EventIndexer;
  private blockchainService: BlockchainService = BlockchainService.getInstance();;
  private readonly pointService = PointService.get();
  private readonly userService = UserService.get();
  static get() {
    if (EventIndexer.singleInstance) {
      return EventIndexer.singleInstance;
    }
    return new EventIndexer();
  }

  private constructor() {
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

      await this.checkoutSwapEvents(lastBlock);
      await this.checkoutLiquidityEvents(lastBlock);

    } catch (error) {
      console.error("Listener failed on this round:", error);
    }
  }

  public async checkoutSwapEvents(lastBlock: Block | null) {
    console.log(`Indexing swaps from block ${lastBlock}`);

    const latestBlockNumber = lastBlock?.number ?? 5253609n;
    const currentBlockNumber = await this.blockchainService.getLatestBlockNumber();
    console.log(currentBlockNumber)
    // Process blocks in batches to avoid overwhelming the RPC
    const batchSize = BigInt(this.blockchainService["config"].batchSize);
    let fromBlock = latestBlockNumber + 1n;
    
    while (fromBlock <= currentBlockNumber) {
      const toBlock = fromBlock + batchSize - 1n > currentBlockNumber 
        ? currentBlockNumber 
        : fromBlock + batchSize - 1n;
      
      try {
        const swaps = await this.blockchainService.getSwapEvents(fromBlock, toBlock);

        for (const swap of swaps) {
          try {
            const block =
              !lastBlock || lastBlock.number !== swap.blockNumber
                ? await this.saveLastProcessedBlock(swap.blockNumber)
                : lastBlock;
            
            const { tx, user, alreadyProcessed } = await this.markTransactionProcessed(
              swap.transaction.id,
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
              swap.to
            );
            lastBlock = block;

            if (!alreadyProcessed) {
              await this.processNewSwapEvent(tx, user);
            }
          } catch (error) {
            console.error(`Error processing swap ${swap.id}:`, error);
          }
        }
      } catch (error) {
        console.error(`Error fetching swaps from blocks ${fromBlock}-${toBlock}:`, error);
      }
      
      fromBlock = toBlock + 1n;
    }
  }

  public async checkoutLiquidityEvents(lastBlock: Block | null) {
    console.log(`Indexing liquidity events from block ${lastBlock}`);

    const latestBlockNumber = lastBlock?.number ?? 0n;
    const currentBlockNumber = await this.blockchainService.getLatestBlockNumber();
    
    // Process blocks in batches to avoid overwhelming the RPC
    const batchSize = BigInt(this.blockchainService["config"].batchSize);
    let fromBlock = latestBlockNumber + 1n;
    
    while (fromBlock <= currentBlockNumber) {
      const toBlock = fromBlock + batchSize - 1n > currentBlockNumber 
        ? currentBlockNumber 
        : fromBlock + batchSize - 1n;
      
      try {
        const { mints, burns } = await this.blockchainService.getLiquidityEvents(fromBlock, toBlock);

        for (const mint of mints) {
          try {
            const block =
              !lastBlock || lastBlock.number !== mint.blockNumber
                ? await this.saveLastProcessedBlock(mint.blockNumber)
                : lastBlock;

            const { tx, user, alreadyProcessed } = await this.markTransactionProcessed(
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
              mint.to
            );

            lastBlock = block;
            if (!alreadyProcessed) {
              await this.processNewLiquidityEvent(tx, user);
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

            const { tx, user, alreadyProcessed } = await this.markTransactionProcessed(
              burn.transaction.id,
              TransactionType.BURN,
              block.id,
              [
                {
                  symbol: burn.pair.token0.symbol,
                  decimals: burn.pair.token0.decimals,
                  amount: -burn.amount0, // Negative for burn events
                },
                {
                  symbol: burn.pair.token1.symbol,
                  decimals: burn.pair.token1.decimals,
                  amount: -burn.amount1, // Negative for burn events
                },
              ],
              burn.to
            );

            lastBlock = block;
            if (!alreadyProcessed) {
              await this.processNewLiquidityEvent(tx, user);
            }
          } catch (error) {
            console.error(`Error processing burn ${burn.id}:`, error);
          }
        }
      } catch (error) {
        console.error(`Error fetching liquidity events from blocks ${fromBlock}-${toBlock}:`, error);
      }
      
      fromBlock = toBlock + 1n;
    }
  }

  public async processNewSwapEvent(tx: ProcessedTransaction, user?: User | null) {
    if (!user) {
      return;
    }

    await Promise.all([
      this.pointService.update(user, tx),
      prisma.processedTransaction.update({
        data: { userId: user.id },
        where: { id: tx.id },
      }),
    ]);
  }

  public async processNewLiquidityEvent(tx: ProcessedTransaction, user?: User | null) {
    if (!user) {
      return;
    }

    await Promise.all([
      this.pointService.update(user, tx),
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
    try {
      // Try to create the block directly
      return await prisma.block.create({
        data: { number: BigInt(blockNumber) },
      });
    } catch (error) {
      const existingBlock = await prisma.block.findFirst({
        where: { number: blockNumber },
      });
      
      if (!existingBlock) {
        throw error;
      }
      
      return existingBlock;
    }
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
    to: string
  ) {
    const tx = await prisma.processedTransaction.findFirst({
      where: { hash: txHash, type: eventType as TransactionType },
      include: { user: true }
    });

    if (!tx) {
      const performerAddress = await this.blockchainService.getTransactionOrigin(txHash);
      const { user } = await this.userService.findOrCreateUserByAddress(performerAddress);
      const tokens = tokensData.map((tk) => evaluateTokenData(tk));
      const newTx = await prisma.processedTransaction.create({
        data: {
          hash: txHash,
          type: eventType as TransactionType,
          blockId,
          from: performerAddress,
          to,
          token0: tokens[0].symbol,
          token0Amount: tokens[0].amount,
          token1: tokens[1].symbol,
          token1Amount: tokens[1].amount,
          processedAt: new Date(),
          userId: user?.id,
        },
      });
      return { tx: newTx, user, alreadyProcessed: false };
    } 

    if (tx.processedAt) {
      return { tx, user: tx.user, alreadyProcessed: true };
    }
    const { user, ...processedTx } = tx;
    const tokens = tokensData.map((tk) => evaluateTokenData(tk));
    processedTx.processedAt = new Date();
    // make sure token data is synced.
    processedTx.token0 = tokens[0].symbol;
    processedTx.token0Amount = tokens[0].amount;
    processedTx.token1 = tokens[1].symbol;
    processedTx.token1Amount = tokens[1].amount;
    await prisma.processedTransaction.update({
      data: processedTx,
      where: { id: tx.id },
    });

    return { tx, user, alreadyProcessed: false };
  }
}
