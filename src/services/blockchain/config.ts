export interface BlockchainConfig {
  rpcUrl: string
  chainId: number
  factoryAddress: string
  batchSize: number
  maxBatchSteps: number
  maxRetries: number
  retryDelay: number
}

export const DEFAULT_CONFIG: BlockchainConfig = {
  rpcUrl: process.env.RPC_URL || 'https://testnet-rpc.monad.xyz',
  chainId: +(process.env.CHAIN_ID || 10143),
  factoryAddress: '0xf3fd5503fb2bb5f5a7ae713e621ac5c50f191fb3',
  batchSize: 25,
  maxBatchSteps: 4,
  maxRetries: 3,
  retryDelay: 1000, // 1 second
}

export const getConfig = (): BlockchainConfig => {
  return {
    ...DEFAULT_CONFIG,
    rpcUrl: process.env.RPC_URL || DEFAULT_CONFIG.rpcUrl,
    chainId: parseInt(process.env.CHAIN_ID || DEFAULT_CONFIG.chainId.toString()),
    factoryAddress: process.env.FACTORY_ADDRESS || DEFAULT_CONFIG.factoryAddress,
    batchSize: parseInt(process.env.BATCH_SIZE || DEFAULT_CONFIG.batchSize.toString()),
    maxRetries: parseInt(process.env.MAX_RETRIES || DEFAULT_CONFIG.maxRetries.toString()),
    retryDelay: parseInt(process.env.RETRY_DELAY || DEFAULT_CONFIG.retryDelay.toString()),
  }
} 