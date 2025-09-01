export interface BlockchainConfig {
    rpcUrl: string;
    chainId: number;
    factoryAddress: string;
    batchSize: number;
    maxBatchSteps: number;
    maxRetries: number;
    retryDelay: number;
    startFromBlock?: bigint;
}

export const DEFAULT_CONFIG: BlockchainConfig = {
    rpcUrl: "https://testnet-rpc.monad.xyz",
    chainId: 10143,
    factoryAddress: "0xf3fd5503fb2bb5f5a7ae713e621ac5c50f191fb3",
    batchSize: 25,
    maxBatchSteps: 5,
    maxRetries: 3,
    retryDelay: 1, // seconds
    startFromBlock: undefined,
};

export const getConfig = (): BlockchainConfig => {
    return {
        ...DEFAULT_CONFIG,
        rpcUrl: process.env.RPC_URL || DEFAULT_CONFIG.rpcUrl,
        chainId: Number.parseInt(
            process.env.CHAIN_ID || DEFAULT_CONFIG.chainId.toString()
        ),
        factoryAddress:
            process.env.PRIMARY_CONTRACT_ADDRESS ||
            DEFAULT_CONFIG.factoryAddress,
        batchSize: Number.parseInt(
            process.env.BATCH_SIZE || DEFAULT_CONFIG.batchSize.toString()
        ),
        maxBatchSteps: Number.parseInt(
            process.env.MAX_BATCH_STEPS ||
                DEFAULT_CONFIG.maxBatchSteps.toString()
        ),
        maxRetries: Number.parseInt(
            process.env.MAX_ROUND_RETRIES ||
                DEFAULT_CONFIG.maxRetries.toString()
        ),
        retryDelay:
            Number.parseInt(
                process.env.RETRY_DELAY_SEC ||
                    DEFAULT_CONFIG.retryDelay.toString()
            ) * 1000,
        startFromBlock:
            process.env.START_FROM_BLOCK?.trim().length &&
            +process.env.START_FROM_BLOCK >= 0
                ? BigInt(process.env.START_FROM_BLOCK)
                : DEFAULT_CONFIG.startFromBlock,
    };
};
