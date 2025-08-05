export interface BlockchainConfig {
  rpcUrl: string
  chainId: number
  factoryAddress: string
  routerAddress: string
  batchSize: number
  maxRetries: number
  retryDelay: number
}

export const DEFAULT_CONFIG: BlockchainConfig = {
  rpcUrl: process.env.RPC_URL || 'https://testnet-rpc.monad.xyz',
  chainId: 10143,
  factoryAddress: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
  routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  batchSize: 100,
  maxRetries: 3,
  retryDelay: 1000, // 1 second
}

export const getConfig = (): BlockchainConfig => {
  return {
    ...DEFAULT_CONFIG,
    rpcUrl: process.env.RPC_URL || DEFAULT_CONFIG.rpcUrl,
    chainId: parseInt(process.env.CHAIN_ID || DEFAULT_CONFIG.chainId.toString()),
    factoryAddress: process.env.FACTORY_ADDRESS || DEFAULT_CONFIG.factoryAddress,
    routerAddress: process.env.ROUTER_ADDRESS || DEFAULT_CONFIG.routerAddress,
    batchSize: parseInt(process.env.BATCH_SIZE || DEFAULT_CONFIG.batchSize.toString()),
    maxRetries: parseInt(process.env.MAX_RETRIES || DEFAULT_CONFIG.maxRetries.toString()),
    retryDelay: parseInt(process.env.RETRY_DELAY || DEFAULT_CONFIG.retryDelay.toString()),
  }
} 