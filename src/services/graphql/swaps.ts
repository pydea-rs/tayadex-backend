import type { IPairTokenMinimalData, IPairTokenSufficientData, ITransactionMinimalData } from "./common";
import { tayaswapSubpgrah } from "./constants";
import { GET_USER_SWAPS } from "./queries";

export interface ISwapOperation {
  id: number;
  pair: IPairTokenMinimalData;
  amount0In: number;
  amount0Out: number;
  amount1In: number;
  amount1Out: number;
  timestamp: number; // TODO: string, Date, ...
}

export interface ISwapQueryResult {
  swaps: ISwapOperation[];
}

export async function fetchUserSwaps(address: string) {
  const { swaps } = (await tayaswapSubpgrah(GET_USER_SWAPS, {
    address,
  })) as ISwapQueryResult;
  return swaps;
}

export interface INewSwapData extends ISwapOperation {
  pair: IPairTokenSufficientData;
  from: string;
  to: string;
  blockNumber: bigint;
  transaction: ITransactionMinimalData;
}

export interface INewSwapQueryResult {
  swaps: INewSwapData[];
}
