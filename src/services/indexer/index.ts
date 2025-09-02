import {
    type ProcessedTransaction,
    TransactionType,
    type User,
} from "@prisma/client";
import { PointService } from "../point";
import { BlockchainService } from "../blockchain";
import { evaluateTokenData, type TokensNumericalData } from "@/utils";
import { UserService } from "../user";
import { prisma } from "../prisma";
import type { InputJsonValue } from "@prisma/client/runtime/library";
import { Queue } from "mnemonist";
import {
    type TransactionProcessorPayloadType,
    type TransactionQueueElement,
} from "./types";
import cron from "node-cron";

export class EventIndexer {
    private static singleInstance: EventIndexer;
    private trxQueue = new Queue<TransactionQueueElement>();
    private readonly blockchainService: BlockchainService =
        BlockchainService.get();
    private readonly pointService = PointService.get();
    private readonly userService = UserService.get();

    private alreadyListening = false;

    static get() {
        if (EventIndexer.singleInstance) {
            return EventIndexer.singleInstance;
        }
        return new EventIndexer();
    }

    private constructor() {
        if (EventIndexer.singleInstance) {
            return EventIndexer.singleInstance; // Double check re-instanciation block.
        } else {
            // Schedule the cron job to run every 10 seconds
            cron.schedule("* * * * * *", () => {
                this.processTransactionQueue().catch((error) => {
                    console.error(
                        "Failed processing this round of transaction queue:",
                        error
                    );
                });
            });
        }
    }

    lock() {
        this.alreadyListening = true;
    }

    unlock() {
        this.alreadyListening = false;
    }

    async listen() {
        if (this.alreadyListening) {
            return;
        }
        console.log("Indexer next round started...");
        try {
            const lastFinalizedBlockNumber =
                await this.blockchainService.getLastFinalizedBlockNumber();
            this.lock();
            const lastSwapBlock = await this.checkoutSwapEvents(
                lastFinalizedBlockNumber
            );
            const lastMintBurnBlock = await this.checkoutLiquidityEvents(
                lastFinalizedBlockNumber
            );
            this.unlock();
            await this.blockchainService.updateLastIndexedBlock(
                lastSwapBlock < lastMintBurnBlock
                    ? lastSwapBlock
                    : lastMintBurnBlock
            );
        } catch (error) {
            console.error("Listener failed on this round:", error);
        }
    }

    public async checkoutSwapEvents(untilBlock: bigint) {
        let lastSuccessfullyIndexedBlock =
            this.blockchainService.defaultChain.lastIndexedBlock ??
            this.blockchainService.config.startFromBlock ??
            untilBlock;

        // Process blocks in batches to avoid overwhelming the RPC
        const batchSize = BigInt(this.blockchainService.config.batchSize);
        const maxBatchSteps =
            this.blockchainService.config.maxBatchSteps ?? 100;
        let fromBlock = lastSuccessfullyIndexedBlock + 1n;

        for (
            let step = 0;
            fromBlock <= untilBlock && step < maxBatchSteps;
            step++
        ) {
            const toBlock =
                fromBlock + batchSize - 1n > untilBlock
                    ? untilBlock
                    : fromBlock + batchSize - 1n;
            console.log(`SwapEvents: ${fromBlock} -> ${toBlock}`);
            try {
                const swaps = await this.blockchainService.getSwapEvents(
                    fromBlock,
                    toBlock
                );

                for (const swap of swaps) {
                    try {
                        this.enqueuNewTransaction(
                            swap.transaction.id,
                            TransactionType.SWAP,
                            swap.blockNumber,
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
                    } catch (error) {
                        console.error(
                            `Error processing swap ${swap.id}:`,
                            error
                        );
                    }
                }
                lastSuccessfullyIndexedBlock = toBlock;
            } catch (error) {
                console.error(
                    `Error fetching swaps from blocks ${fromBlock}-${toBlock}:`,
                    error
                );
                // FIXME: In case one event log wasnt processed, how we can inform indexer about that?
            }

            fromBlock = toBlock + 1n;

            if (fromBlock < untilBlock) {
                await new Promise((resolve) => setTimeout(resolve, 500)); // TODO: See if there's better way.
            }
        }
        console.log(
            `Swap Events successfully processed until block#${lastSuccessfullyIndexedBlock}.`
        );
        return lastSuccessfullyIndexedBlock;
    }

    public async checkoutLiquidityEvents(untilBlock: bigint) {
        let lastSuccessfullyIndexedBlock =
            this.blockchainService.defaultChain.lastIndexedBlock ?? 5253609n;

        const batchSize = BigInt(this.blockchainService.config.batchSize);
        const maxBatchSteps =
            this.blockchainService.config.maxBatchSteps ?? 100;
        let fromBlock = lastSuccessfullyIndexedBlock + 1n;

        for (
            let step = 0;
            fromBlock <= untilBlock && step < maxBatchSteps;
            step++
        ) {
            const toBlock =
                fromBlock + batchSize - 1n > untilBlock
                    ? untilBlock
                    : fromBlock + batchSize - 1n;
            console.log(`LiquidityEvents: ${fromBlock} -> ${toBlock}`);
            try {
                const { mints, burns } =
                    await this.blockchainService.getLiquidityEvents(
                        fromBlock,
                        toBlock
                    );

                for (const mint of mints) {
                    try {
                        this.enqueuNewTransaction(
                            mint.transaction.id,
                            TransactionType.MINT,
                            mint.blockNumber,
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
                    } catch (error) {
                        // FIXME: In case one event log wasnt processed, how we can inform indexer about that?
                        // TODO/SOLUTION: Hmm. Maybe push failed tx Hashes to an array and try them later?!
                        console.error(
                            `Error processing mint ${mint.id}:`,
                            error
                        );
                    }
                }

                for (const burn of burns) {
                    try {
                        this.enqueuNewTransaction(
                            burn.transaction.id,
                            TransactionType.BURN,
                            burn.blockNumber,
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
                    } catch (error) {
                        console.error(
                            `Error processing burn ${burn.id}:`,
                            error
                        );
                    }
                }

                lastSuccessfullyIndexedBlock = toBlock;
            } catch (error) {
                console.error(
                    `Error fetching liquidity events from blocks ${fromBlock}-${toBlock}:`,
                    error
                );
                // TODO: In case one event log wasnt processed, how we can inform indexer about that?
            }

            fromBlock = toBlock + 1n;
            if (fromBlock < untilBlock) {
                await new Promise((resolve) => setTimeout(resolve, 500));
            }
        }
        console.log(
            `Liquidity Events successfully processed until block#${lastSuccessfullyIndexedBlock}.`
        );
        return lastSuccessfullyIndexedBlock;
    }

    public async processNewSwapEvent(
        tx: ProcessedTransaction,
        user?: User | null
    ) {
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

    public async processNewLiquidityEvent(
        tx: ProcessedTransaction,
        user?: User | null
    ) {
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

    async isTransactionProcessed(
        txHash: string,
        eventType: TransactionType | string // TODO: Is this required?
    ): Promise<boolean> {
        return Boolean(
            await prisma.processedTransaction.findFirst({
                where: { hash: txHash, type: eventType as TransactionType },
            })
        );
    }

    enqueuNewTransaction(
        txHash: string,
        eventType: string | TransactionType,
        blockNumber: bigint,
        tokensData: TokensNumericalData[],
        to: string,
        metadata?: InputJsonValue
    ) {
        this.trxQueue.enqueue({
            payload: {
                txHash,
                eventType,
                blockNumber,
                tokensData,
                to,
                metadata,
            },
            retries: 0,
        });
    }

    async markTransactionProcessed({
        txHash,
        eventType,
        blockNumber,
        tokensData,
        to,
        metadata = undefined,
    }: TransactionProcessorPayloadType) {
        const tx = await prisma.processedTransaction.findFirst({
            where: { hash: txHash, type: eventType as TransactionType },
            include: { user: true },
        });

        if (!tx) {
            const performerAddress =
                await this.blockchainService.getTransactionOrigin(txHash);
            const { user } = await this.userService.findOrCreateUserByAddress(
                performerAddress
            );
            const tokens = tokensData.map((tk) => evaluateTokenData(tk));
            const newTx = await prisma.processedTransaction.create({
                data: {
                    hash: txHash,
                    type: eventType as TransactionType,
                    blockNumber,
                    from: performerAddress,
                    to,
                    token0: tokens[0].symbol,
                    token0Amount: tokens[0].amount,
                    token1: tokens[1].symbol,
                    token1Amount: tokens[1].amount,
                    processedAt: new Date(),
                    userId: user?.id,
                    chainId: this.blockchainService.defaultChain.id,
                    metadata: metadata,
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
            data: {
                ...processedTx,
                metadata: metadata ?? (processedTx.metadata as InputJsonValue),
            },
            where: { id: tx.id },
        });

        return { tx, user, alreadyProcessed: false };
    }

    async processTransactionQueue() {
        try {
            const { payload, retries } = this.trxQueue.dequeue() ?? {
                payload: undefined,
                retries: 0,
            };
            if (!payload) {
                return;
            }
            try {
                const { tx, user, alreadyProcessed } =
                    await this.markTransactionProcessed(payload);

                if (!alreadyProcessed) {
                    switch (tx.type) {
                        case TransactionType.SWAP:
                            await this.processNewSwapEvent(tx, user);
                            break;
                        case TransactionType.BURN:
                        case TransactionType.MINT:
                            await this.processNewLiquidityEvent(tx, user);
                            break;
                    }
                }
            } catch (ex) {
                console.error(
                    `Failed processing ${payload.eventType} event:`,
                    ex
                );
                if (payload && retries < 3)
                    this.trxQueue.enqueue({ payload, retries: retries + 1 }); // enqueue for reprocess.
            }
        } catch (ex) {
            if (!this.trxQueue.peek()) {
                return;
            }
            console.error("Processing transaction in queue failed!", ex);
        }
    }
}
