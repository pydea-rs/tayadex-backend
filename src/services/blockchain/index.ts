import { createPublicClient, http, parseAbi, type Address } from 'viem'
import { monadTestnet } from 'viem/chains'
import { getConfig, type BlockchainConfig } from './config'
import { ethers } from 'ethers'

// Event signatures for TayaSwap V2
const SWAP_EVENT_SIGNATURE = 'Swap(address,uint256,uint256,uint256,uint256,address)'
const MINT_EVENT_SIGNATURE = 'Mint(address,uint256,uint256)'
const BURN_EVENT_SIGNATURE = 'Burn(address,uint256,uint256,address)'

// ABI for parsing events
const PAIR_ABI = parseAbi([
  'event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)',
  'event Mint(address indexed sender, uint amount0, uint amount1)',
  'event Burn(address indexed sender, uint amount0, uint amount1, address indexed to)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
])

const ERC20_ABI = parseAbi([
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
])

export interface SwapEvent {
  id: string
  from: string
  to: string
  amount0In: bigint
  amount1In: bigint
  amount0Out: bigint
  amount1Out: bigint
  blockNumber: bigint
  timestamp: bigint
  transaction: { id: string }
  pair: {
    id: string
    token0: { symbol: string; decimals: number }
    token1: { symbol: string; decimals: number }
  }
}

export interface LiquidityEvent {
  id: string
  sender: string
  to: string
  amount0: bigint
  amount1: bigint
  blockNumber: bigint
  timestamp: bigint
  transaction: { id: string }
  pair: {
    id: string
    token0: { symbol: string; decimals: number }
    token1: { symbol: string; decimals: number }
  }
}

export interface LiquidityProvisionResult {
  mints: LiquidityEvent[]
  burns: LiquidityEvent[]
}

interface TokenInfo {
  symbol: string
  decimals: number
}

interface PairInfo {
  token0: TokenInfo
  token1: TokenInfo
}

export class BlockchainService {
  private static instance: BlockchainService
  private client: ReturnType<typeof createPublicClient>
  private config: BlockchainConfig
  private tokenCache: Map<string, TokenInfo> = new Map()
  private pairCache: Map<string, PairInfo> = new Map()

  private constructor() {
    this.config = getConfig()
    this.client = createPublicClient({
      chain: monadTestnet,
      transport: http(this.config.rpcUrl),
    })
  }

  static getInstance(): BlockchainService {
    if (!BlockchainService.instance) {
      BlockchainService.instance = new BlockchainService()
    }
    return BlockchainService.instance
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        console.warn(`Attempt ${attempt} failed:`, error)
        
        if (attempt < this.config.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay))
        }
      }
    }
    
    throw lastError || new Error('Operation failed after all retries')
  }

  private async getTokenInfo(tokenAddress: string): Promise<TokenInfo> {
    // Check cache first
    if (this.tokenCache.has(tokenAddress)) {
      return this.tokenCache.get(tokenAddress)!
    }

    // Fetch token info
    const [symbol, decimals] = await Promise.all([
      this.withRetry(() => this.client.readContract({
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: 'symbol',
      })),
      this.withRetry(() => this.client.readContract({
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: 'decimals',
      })),
    ])

    const tokenInfo: TokenInfo = { symbol, decimals }
    this.tokenCache.set(tokenAddress, tokenInfo)
    return tokenInfo
  }

  private async getPairInfo(pairAddress: string): Promise<PairInfo> {
    // Check cache first
    if (this.pairCache.has(pairAddress)) {
      return this.pairCache.get(pairAddress)!
    }

    // Get token addresses
    const [token0Address, token1Address] = await Promise.all([
      this.withRetry(() => this.client.readContract({
        address: pairAddress as Address,
        abi: PAIR_ABI,
        functionName: 'token0',
      })),
      this.withRetry(() => this.client.readContract({
        address: pairAddress as Address,
        abi: PAIR_ABI,
        functionName: 'token1',
      })),
    ])

    // Get token info (this will use cache if available)
    const [token0Info, token1Info] = await Promise.all([
      this.getTokenInfo(token0Address),
      this.getTokenInfo(token1Address),
    ])

    const pairInfo: PairInfo = {
      token0: token0Info,
      token1: token1Info,
    }
    this.pairCache.set(pairAddress, pairInfo)
    return pairInfo
  }

  private async batchGetPairInfo(pairAddresses: string[]): Promise<Map<string, PairInfo>> {
    const uniqueAddresses = [...new Set(pairAddresses)]
    const results = new Map<string, PairInfo>()
    
    // Process in batches to avoid overwhelming the RPC
    const batchSize = Math.min(10, this.config.batchSize * 2) // Use config batch size but cap at 10
    for (let i = 0; i < uniqueAddresses.length; i += batchSize) {
      const batch = uniqueAddresses.slice(i, i + batchSize)
      const batchPromises = batch.map(async (address) => {
        try {
          const pairInfo = await this.getPairInfo(address)
          return { address, pairInfo }
        } catch (error) {
          console.error(`Error getting pair info for ${address}:`, error)
          return null
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      batchResults.forEach(result => {
        if (result) {
          results.set(result.address, result.pairInfo)
        }
      })
      
      // Add delay between batches to avoid rate limiting
      if (i + batchSize < uniqueAddresses.length) {
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay / 2))
      }
    }
    
    return results
  }

  private async batchGetBlocks(blockNumbers: bigint[]): Promise<Map<bigint, any>> {
    const uniqueBlocks = [...new Set(blockNumbers)]
    const results = new Map<bigint, any>()
    
    // Process in batches to avoid overwhelming the RPC
    const batchSize = Math.min(5, this.config.batchSize)
    for (let i = 0; i < uniqueBlocks.length; i += batchSize) {
      const batch = uniqueBlocks.slice(i, i + batchSize)
      const batchPromises = batch.map(async (blockNumber) => {
        try {
          const block = await this.getBlock(blockNumber)
          return { blockNumber, block }
        } catch (error) {
          console.error(`Error getting block ${blockNumber}:`, error)
          return null
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      batchResults.forEach(result => {
        if (result) {
          results.set(result.blockNumber, result.block)
        }
      })
      
      // Add delay between batches to avoid rate limiting
      if (i + batchSize < uniqueBlocks.length) {
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay / 2))
      }
    }
    
    return results
  }

  // Method to clear caches if needed
  clearCaches(): void {
    this.tokenCache.clear()
    this.pairCache.clear()
  }

  // Method to get cache statistics
  getCacheStats(): { tokenCacheSize: number; pairCacheSize: number } {
    return {
      tokenCacheSize: this.tokenCache.size,
      pairCacheSize: this.pairCache.size,
    }
  }

  async getLatestBlockNumber(): Promise<bigint> {
    return await this.withRetry(() => this.client.getBlockNumber())
  }

  async getBlock(blockNumber: bigint) {
    return await this.withRetry(() => this.client.getBlock({ blockNumber }))
  }

  getLogs(fromBlock: bigint, toBlock: bigint, address?: Address) {
    return this.withRetry(() => this.client.getLogs({
      fromBlock,
      toBlock,
      address,
      event: {
        type: 'event',
        name: 'Swap',
        inputs: [
          { type: 'address', name: 'sender', indexed: true },
          { type: 'uint256', name: 'amount0In' },
          { type: 'uint256', name: 'amount1In' },
          { type: 'uint256', name: 'amount0Out' },
          { type: 'uint256', name: 'amount1Out' },
          { type: 'address', name: 'to', indexed: true },
        ],
      },
    }))
  }

  async getSwapEvents(fromBlock: bigint, toBlock: bigint): Promise<SwapEvent[]> {
    const logs = await this.withRetry(() => this.client.getLogs({
      fromBlock,
      toBlock,
      event: {
        type: 'event',
        name: 'Swap',
        inputs: [
          { type: 'address', name: 'sender', indexed: true },
          { type: 'uint256', name: 'amount0In' },
          { type: 'uint256', name: 'amount1In' },
          { type: 'uint256', name: 'amount0Out' },
          { type: 'uint256', name: 'amount1Out' },
          { type: 'address', name: 'to', indexed: true },
        ],
      },
    }))

    if (logs.length === 0) {
      return []
    }

    // Get all unique pair addresses and block numbers
    const pairAddresses = [...new Set(logs.map(log => log.address))]
    const blockNumbers = [...new Set(logs.map(log => log.blockNumber!))]
    
    // Batch fetch pair information and blocks
    const [pairInfoMap, blockMap] = await Promise.all([
      this.batchGetPairInfo(pairAddresses),
      this.batchGetBlocks(blockNumbers)
    ])

    const swapEvents: SwapEvent[] = []

    for (const log of logs) {
      try {
        const block = blockMap.get(log.blockNumber!)
        if (!block) {
          console.error(`No block found for ${log.blockNumber}`)
          continue
        }
        
        const pairAddress = log.address
        const pairInfo = pairInfoMap.get(pairAddress)
        if (!pairInfo) {
          console.error(`No pair info found for ${pairAddress}`)
          continue
        }

        const iface = new ethers.Interface(PAIR_ABI as any)
        const decodedLog = iface.parseLog({
          data: log.data,
          topics: log.topics,
        })
        if(!decodedLog) {
            console.error('Failed processing a pair log;')
            continue;
        }
        swapEvents.push({
          id: `${log.transactionHash}-${log.logIndex}`,
          from: decodedLog.args.sender,
          to: decodedLog.args.to,
          amount0In: decodedLog.args.amount0In,
          amount1In: decodedLog.args.amount1In,
          amount0Out: decodedLog.args.amount0Out,
          amount1Out: decodedLog.args.amount1Out,
          blockNumber: log.blockNumber!,
          timestamp: BigInt(block.timestamp),
          transaction: { id: log.transactionHash },
          pair: {
            id: pairAddress,
            token0: pairInfo.token0,
            token1: pairInfo.token1,
          },
        })
      } catch (error) {
        console.error(`Error processing swap log ${log.transactionHash}:`, error)
      }
    }

    return swapEvents
  }

  async getLiquidityEvents(fromBlock: bigint, toBlock: bigint): Promise<LiquidityProvisionResult> {
    const [mintLogs, burnLogs] = await Promise.all([
      this.withRetry(() => this.client.getLogs({
        fromBlock,
        toBlock,
        event: {
          type: 'event',
          name: 'Mint',
          inputs: [
            { type: 'address', name: 'sender', indexed: true },
            { type: 'uint256', name: 'amount0' },
            { type: 'uint256', name: 'amount1' },
          ],
        },
      })),
      this.withRetry(() => this.client.getLogs({
        fromBlock,
        toBlock,
        event: {
          type: 'event',
          name: 'Burn',
          inputs: [
            { type: 'address', name: 'sender', indexed: true },
            { type: 'uint256', name: 'amount0' },
            { type: 'uint256', name: 'amount1' },
            { type: 'address', name: 'to', indexed: true },
          ],
        },
      })),
    ])

    const mints: LiquidityEvent[] = []
    const burns: LiquidityEvent[] = []

    // Get all unique pair addresses and block numbers from both mint and burn logs
    const allPairAddresses = [...new Set([
      ...mintLogs.map(log => log.address),
      ...burnLogs.map(log => log.address)
    ])]
    const allBlockNumbers = [...new Set([
      ...mintLogs.map(log => log.blockNumber!),
      ...burnLogs.map(log => log.blockNumber!)
    ])]
    
    // Batch fetch pair information and blocks
    const [pairInfoMap, blockMap] = await Promise.all([
      this.batchGetPairInfo(allPairAddresses),
      this.batchGetBlocks(allBlockNumbers)
    ])

    // Process mint events
    for (const log of mintLogs) {
      try {
        const block = blockMap.get(log.blockNumber!)
        if (!block) {
          console.error(`No block found for ${log.blockNumber}`)
          continue
        }
        
        const pairAddress = log.address
        const pairInfo = pairInfoMap.get(pairAddress)
        
        if (!pairInfo) {
          console.error(`No pair info found for ${pairAddress}`)
          continue
        }

        const iface = new ethers.Interface(PAIR_ABI as any)
        const decodedLog = iface.parseLog({
          data: log.data,
          topics: log.topics,
        })
        if(!decodedLog) {
            console.error('Failed processing a mint event log;')
            continue;
        }
        mints.push({
          id: `${log.transactionHash}-${log.logIndex}`,
          sender: decodedLog.args.sender,
          to: decodedLog.args.sender, // Mint events don't have a 'to' field, using sender
          amount0: decodedLog.args.amount0,
          amount1: decodedLog.args.amount1,
          blockNumber: log.blockNumber!,
          timestamp: BigInt(block.timestamp),
          transaction: { id: log.transactionHash },
          pair: {
            id: pairAddress,
            token0: pairInfo.token0,
            token1: pairInfo.token1,
          },
        })
      } catch (error) {
        console.error(`Error processing mint log ${log.transactionHash}:`, error)
      }
    }

    // Process burn events
    for (const log of burnLogs) {
      try {
        const block = blockMap.get(log.blockNumber!)
        if (!block) {
          console.error(`No block found for ${log.blockNumber}`)
          continue
        }
        
        const pairAddress = log.address
        const pairInfo = pairInfoMap.get(pairAddress)
        
        if (!pairInfo) {
          console.error(`No pair info found for ${pairAddress}`)
          continue
        }

        const iface = new ethers.Interface(PAIR_ABI as any)
        const decodedLog = iface.parseLog({
          data: log.data,
          topics: log.topics,
        })
        if(!decodedLog) {
            console.error('Failed processing a burn event log;')
            continue;
        }

        burns.push({
          id: `${log.transactionHash}-${log.logIndex}`,
          sender: decodedLog.args.sender,
          to: decodedLog.args.to,
          amount0: decodedLog.args.amount0,
          amount1: decodedLog.args.amount1,
          blockNumber: log.blockNumber!,
          timestamp: BigInt(block.timestamp),
          transaction: { id: log.transactionHash },
          pair: {
            id: pairAddress,
            token0: pairInfo.token0,
            token1: pairInfo.token1,
          },
        })
      } catch (error) {
        console.error(`Error processing burn log ${log.transactionHash}:`, error)
      }
    }

    return { mints, burns }
  }
} 