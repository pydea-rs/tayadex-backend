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

export class EventIndexer {
    private static singleInstance: EventIndexer;
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
            const currentBlockNumber =
                await this.blockchainService.getLatestBlockNumber();
            this.lock();
            const lastSwapBlock = await this.checkoutSwapEvents(currentBlockNumber); 
            const lastMintBurnBlock = await this.checkoutLiquidityEvents(currentBlockNumber);
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

                await Promise.all(
                    swaps.map(async (swap) => {
                        try {
                            const { tx, user, alreadyProcessed } =
                                await this.markTransactionProcessed(
                                    swap.transaction.id,
                                    TransactionType.SWAP,
                                    swap.blockNumber,
                                    [
                                        {
                                            symbol: swap.pair.token0.symbol,
                                            decimals: swap.pair.token0.decimals,
                                            amount:
                                                swap.amount0In -
                                                swap.amount0Out,
                                        },
                                        {
                                            symbol: swap.pair.token1.symbol,
                                            decimals: swap.pair.token1.decimals,
                                            amount:
                                                swap.amount1In -
                                                swap.amount1Out,
                                        },
                                    ],
                                    swap.to
                                );

                            if (!alreadyProcessed) {
                                await this.processNewSwapEvent(tx, user);
                            }
                        } catch (error) {
                            console.error(
                                `Error processing swap ${swap.id}:`,
                                error
                            );
                        }
                    })
                );
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

                await Promise.all(
                    mints.map(async (mint) => {
                        try {
                            const { tx, user, alreadyProcessed } =
                                await this.markTransactionProcessed(
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

                            if (!alreadyProcessed) {
                                await this.processNewLiquidityEvent(tx, user);
                            }
                        } catch (error) {
                            // FIXME: In case one event log wasnt processed, how we can inform indexer about that?
                            // TODO/SOLUTION: Hmm. Maybe push failed tx Hashes to an array and try them later?!
                            console.error(
                                `Error processing mint ${mint.id}:`,
                                error
                            );
                        }
                    })
                );

                await Promise.all(
                    burns.map(async (burn) => {
                        try {
                            const { tx, user, alreadyProcessed } =
                                await this.markTransactionProcessed(
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

                            if (!alreadyProcessed) {
                                await this.processNewLiquidityEvent(tx, user);
                            }
                        } catch (error) {
                            console.error(
                                `Error processing burn ${burn.id}:`,
                                error
                            );
                        }
                    })
                );

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

    async markTransactionProcessed(
        txHash: string,
        eventType: string | TransactionType,
        blockNumber: bigint,
        tokensData: TokensNumericalData[],
        to: string,
        metadata?: InputJsonValue
    ) {
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
}
