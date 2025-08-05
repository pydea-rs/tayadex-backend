import { createPublicClient, http, parseAbi, type Address } from 'viem'
import { monadTestnet } from 'viem/chains'
import { getConfig, type BlockchainConfig } from './config'
import { ethers } from 'ethers'

// TayaSwap V2 Factory and Router addresses
const TAYASWAP_FACTORY_ADDRESS = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f' as Address
const TAYASWAP_ROUTER_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' as Address

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

export class BlockchainService {
  private static instance: BlockchainService
  private client: ReturnType<typeof createPublicClient>
  private config: BlockchainConfig

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

  async getLatestBlockNumber(): Promise<bigint> {
    return await this.withRetry(() => this.client.getBlockNumber())
  }

  async getBlock(blockNumber: bigint) {
    return await this.withRetry(() => this.client.getBlock({ blockNumber }))
  }

  async getLogs(fromBlock: bigint, toBlock: bigint, address?: Address) {
    return await this.withRetry(() => this.client.getLogs({
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

    const swapEvents: SwapEvent[] = []

    for (const log of logs) {
      try {
        const block = await this.getBlock(log.blockNumber!)
        const pairAddress = log.address

        // Get token information
        const [token0Address, token1Address] = await Promise.all([
          this.withRetry(() => this.client.readContract({
            address: pairAddress,
            abi: PAIR_ABI,
            functionName: 'token0',
          })),
          this.withRetry(() => this.client.readContract({
            address: pairAddress,
            abi: PAIR_ABI,
            functionName: 'token1',
          })),
        ])

        const [token0Symbol, token0Decimals, token1Symbol, token1Decimals] = await Promise.all([
          this.withRetry(() => this.client.readContract({
            address: token0Address,
            abi: ERC20_ABI,
            functionName: 'symbol',
          })),
          this.withRetry(() => this.client.readContract({
            address: token0Address,
            abi: ERC20_ABI,
            functionName: 'decimals',
          })),
          this.withRetry(() => this.client.readContract({
            address: token1Address,
            abi: ERC20_ABI,
            functionName: 'symbol',
          })),
          this.withRetry(() => this.client.readContract({
            address: token1Address,
            abi: ERC20_ABI,
            functionName: 'decimals',
          })),
        ])

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
            token0: { symbol: token0Symbol, decimals: token0Decimals },
            token1: { symbol: token1Symbol, decimals: token1Decimals },
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

    // Process mint events
    for (const log of mintLogs) {
      try {
        const block = await this.getBlock(log.blockNumber!)
        const pairAddress = log.address

        const [token0Address, token1Address] = await Promise.all([
          this.withRetry(() => this.client.readContract({
            address: pairAddress,
            abi: PAIR_ABI,
            functionName: 'token0',
          })),
          this.withRetry(() => this.client.readContract({
            address: pairAddress,
            abi: PAIR_ABI,
            functionName: 'token1',
          })),
        ])

        const [token0Symbol, token0Decimals, token1Symbol, token1Decimals] = await Promise.all([
          this.withRetry(() => this.client.readContract({
            address: token0Address,
            abi: ERC20_ABI,
            functionName: 'symbol',
          })),
          this.withRetry(() => this.client.readContract({
            address: token0Address,
            abi: ERC20_ABI,
            functionName: 'decimals',
          })),
          this.withRetry(() => this.client.readContract({
            address: token1Address,
            abi: ERC20_ABI,
            functionName: 'symbol',
          })),
          this.withRetry(() => this.client.readContract({
            address: token1Address,
            abi: ERC20_ABI,
            functionName: 'decimals',
          })),
        ])

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
            token0: { symbol: token0Symbol, decimals: token0Decimals },
            token1: { symbol: token1Symbol, decimals: token1Decimals },
          },
        })
      } catch (error) {
        console.error(`Error processing mint log ${log.transactionHash}:`, error)
      }
    }

    // Process burn events
    for (const log of burnLogs) {
      try {
        const block = await this.getBlock(log.blockNumber!)
        const pairAddress = log.address

        const [token0Address, token1Address] = await Promise.all([
          this.withRetry(() => this.client.readContract({
            address: pairAddress,
            abi: PAIR_ABI,
            functionName: 'token0',
          })),
          this.withRetry(() => this.client.readContract({
            address: pairAddress,
            abi: PAIR_ABI,
            functionName: 'token1',
          })),
        ])

        const [token0Symbol, token0Decimals, token1Symbol, token1Decimals] = await Promise.all([
          this.withRetry(() => this.client.readContract({
            address: token0Address,
            abi: ERC20_ABI,
            functionName: 'symbol',
          })),
          this.withRetry(() => this.client.readContract({
            address: token0Address,
            abi: ERC20_ABI,
            functionName: 'decimals',
          })),
          this.withRetry(() => this.client.readContract({
            address: token1Address,
            abi: ERC20_ABI,
            functionName: 'symbol',
          })),
          this.withRetry(() => this.client.readContract({
            address: token1Address,
            abi: ERC20_ABI,
            functionName: 'decimals',
          })),
        ])

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
            token0: { symbol: token0Symbol, decimals: token0Decimals },
            token1: { symbol: token1Symbol, decimals: token1Decimals },
          },
        })
      } catch (error) {
        console.error(`Error processing burn log ${log.transactionHash}:`, error)
      }
    }

    return { mints, burns }
  }
} 