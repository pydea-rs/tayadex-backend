import { IPairTokenMinimalData } from "./common";
import { tayaswapSubpgrah } from "./constants";
import { GET_USER_LIQUIDITY, GET_USER_SWAPS } from "./queries";

export interface ISwapPairToken {
  symbol: string;
}

export interface ISwapPairData {
  id: number;
  token0: ISwapPairToken;
  token1: ISwapPairToken;
}

export interface IMintOrBurnOperation {
  id: number;
  pair: IPairTokenMinimalData;
  amount0: number;
  amount1: number;
  timestamp: number; // TODO: string, Date, ...
}

export interface ILiquidityProvisionQueryResult {
  mints: IMintOrBurnOperation[];
  burns: IMintOrBurnOperation[];
}

export async function fetchUserLiquidityProvisions(address: string) {
  const { mints, burns } = (await tayaswapSubpgrah(GET_USER_LIQUIDITY, {
    address,
  })) as ILiquidityProvisionQueryResult;
  return { mints, burns };
}
