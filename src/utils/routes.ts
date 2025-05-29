import type { IPairData } from '@/services'
import { TradeDirection } from '@/types'
import { parseUnits } from 'viem'
import { getAmountIn, getAmountOut } from './uniswapv2'

function existsPool(tokenA: string, tokenB: string, pools: IPairData[]): boolean {
  for (let i = 0; i < pools.length; i++) {
    const p = pools[i]
    if (
      (p.token0.id.toLowerCase() === tokenA.toLowerCase() && p.token1.id.toLowerCase() === tokenB.toLowerCase()) ||
      (p.token0.id.toLowerCase() === tokenB.toLowerCase() && p.token1.id.toLowerCase() === tokenA.toLowerCase())
    ) {
      return true
    }
  }
  return false
}

function getPool(tokenA: string, tokenB: string, pools: IPairData[]): IPairData | undefined {
  return pools.find(
    (p) =>
      (p.token0.id.toLowerCase() === tokenA.toLowerCase() && p.token1.id.toLowerCase() === tokenB.toLowerCase()) ||
      (p.token0.id.toLowerCase() === tokenB.toLowerCase() && p.token1.id.toLowerCase() === tokenA.toLowerCase())
  )
}

function getReservesForSwap(tokenA: string, pool: IPairData): { reserveIn: bigint; reserveOut: bigint } {
  if (tokenA.toLowerCase() === pool.token0.id.toLowerCase()) {
    return { reserveIn: parseUnits(pool.reserve0, 18), reserveOut: parseUnits(pool.reserve1, 18) }
  }
  return { reserveIn: parseUnits(pool.reserve1, 18), reserveOut: parseUnits(pool.reserve0, 18) }
}

function calculateIdealTrade(amount: bigint, route: string[], pools: IPairData[], direction: TradeDirection): bigint {
  let ideal: bigint = amount
  if (route.length === 0) return ideal

  if (direction === TradeDirection.ExactInput) {
    for (let i = 0; i < route.length - 1; i++) {
      const pool = getPool(route[i], route[i + 1], pools)
      if (!pool) continue

      const { reserveIn, reserveOut } = getReservesForSwap(route[i], pool)

      ideal = (ideal * reserveOut) / reserveIn
    }
  } else {
    for (let i = route.length - 1; i > 0; i--) {
      const pool = getPool(route[i - 1], route[i], pools)
      if (!pool) continue

      const { reserveIn, reserveOut } = getReservesForSwap(route[i - 1], pool)

      ideal = (ideal * reserveIn) / reserveOut
    }
  }

  return ideal
}

async function findBestRoute(
  amount: bigint,
  tokenIn: string,
  tokenOut: string,
  pools: IPairData[],
  direction: TradeDirection
): Promise<{ route: string[]; output: bigint; priceImpact: number; suggestedSlippage: number }> {
  if (amount === 0n) return { route: [], output: 0n, priceImpact: 0, suggestedSlippage: 0 }

  const routes: string[][] = []

  if (existsPool(tokenIn, tokenOut, pools)) {
    routes.push([tokenIn, tokenOut])
  }

  const candidateSet = new Set<string>()
  for (let i = 0; i < pools.length; i++) {
    candidateSet.add(pools[i].token0.id)
    candidateSet.add(pools[i].token1.id)
  }
  candidateSet.delete(tokenIn)
  candidateSet.delete(tokenOut)
  const candidates = Array.from(candidateSet)

  for (let i = 0; i < candidates.length; i++) {
    const x = candidates[i]
    if (existsPool(tokenIn, x, pools) && existsPool(x, tokenOut, pools)) {
      routes.push([tokenIn, x, tokenOut])
    }
  }

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const x = candidates[i]
      const y = candidates[j]
      if (existsPool(tokenIn, x, pools) && existsPool(x, y, pools) && existsPool(y, tokenOut, pools)) {
        routes.push([tokenIn, x, y, tokenOut])
      }
      if (existsPool(tokenIn, y, pools) && existsPool(y, x, pools) && existsPool(x, tokenOut, pools)) {
        routes.push([tokenIn, y, x, tokenOut])
      }
    }
  }

  let bestRoute: string[] = []
  let bestOutput = direction === TradeDirection.ExactInput ? 0n : BigInt(Number.MAX_SAFE_INTEGER)

  for (const route of routes) {
    let result: bigint
    let valid = true

    if (direction === TradeDirection.ExactInput) {
      result = amount
      for (let i = 0; i < route.length - 1; i++) {
        const tokenA = route[i]
        const tokenB = route[i + 1]
        const pool = getPool(tokenA, tokenB, pools)
        if (!pool) {
          valid = false
          break
        }
        const { reserveIn, reserveOut } = getReservesForSwap(tokenA, pool)

        result = getAmountOut(result, reserveIn, reserveOut)
      }
      if (valid && result > bestOutput) {
        bestOutput = result
        bestRoute = route
      }
    } else {
      result = amount
      for (let i = route.length - 1; i > 0; i--) {
        const tokenA = route[i - 1]
        const tokenB = route[i]
        const pool = getPool(tokenA, tokenB, pools)
        if (!pool) {
          valid = false
          break
        }
        const { reserveIn, reserveOut } = getReservesForSwap(tokenA, pool)

        result = getAmountIn(result, reserveIn, reserveOut)
      }
      if (valid && result < bestOutput) {
        bestOutput = result
        bestRoute = route
      }
    }
  }

  let priceImpact = 0

  if (bestRoute.length > 0) {
    const ideal = calculateIdealTrade(amount, bestRoute, pools, direction)
    if (ideal > 0n) {
      if (direction === TradeDirection.ExactInput) {
        priceImpact = Number(ideal - bestOutput) / Number(ideal)
      } else {
        priceImpact = Number(bestOutput - ideal) / Number(ideal)
      }
    }
  }
  const buffer = 0.001

  const suggestedSlippageFraction = priceImpact + buffer

  const suggestedSlippageBP = Math.floor(suggestedSlippageFraction * 10000)

  let adjustedOutput = bestOutput
  if (bestRoute.length > 0) {
    if (direction === TradeDirection.ExactInput) {
      adjustedOutput = (bestOutput * BigInt(10000 - suggestedSlippageBP)) / 10000n
    } else {
      adjustedOutput = (bestOutput * BigInt(10000 + suggestedSlippageBP)) / 10000n
    }
  }

  return { route: bestRoute, output: bestOutput, priceImpact, suggestedSlippage: suggestedSlippageFraction }
}

export { findBestRoute }
