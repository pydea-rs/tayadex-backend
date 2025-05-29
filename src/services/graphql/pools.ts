import type { AppContext } from '@/types'
import { GET_POOLS_QUERY } from './queries'
import { POOLS_CACHE, POOLS_CACHE_KEY, tayaswapSubpgrah } from './constants'

export interface IPairTokenData {
  decimals: string
  id: string
  name: string
  symbol: string
}

export interface IPairData {
  id: string
  reserve0: string
  reserve1: string
  token0: IPairTokenData
  token1: IPairTokenData
  totalSupply: string
  volumeUSD: string
  reserveUSD: string
}

interface IPoolsResponse {
  pairs: IPairData[]
}

async function fetchPools() {
  const { pairs } = (await tayaswapSubpgrah(GET_POOLS_QUERY, {})) as IPoolsResponse

  return pairs
}

export async function getPools(context: AppContext): Promise<IPairData[]> {
  const cachedPools = await context.env.CACHE.get(POOLS_CACHE_KEY)

  const pools = cachedPools ? JSON.parse(cachedPools) : await fetchPools()

  if (!cachedPools) {
    await context.env.CACHE.put(POOLS_CACHE_KEY, JSON.stringify(pools), { expirationTtl: POOLS_CACHE })
  }

  return pools
}
