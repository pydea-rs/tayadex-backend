import { tayaswapSubpgrah } from './constants'
import { GET_SHMON_SWAPS } from './queries'

interface IShmonSwapsResponse {
  pair: {
    swaps: {
      amount0In: string
      amount0Out: string
    }[]
  }
}

export async function fetchShmonSwaps(address: string) {
  const {
    pair: { swaps }
  } = (await tayaswapSubpgrah(GET_SHMON_SWAPS, { address })) as IShmonSwapsResponse

  return swaps
}
