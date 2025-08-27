import type { IPairTokenMinimalData, IPairTokenSufficientData, ITransactionMinimalData } from "./common";
import { tayaswapSubpgrah } from "./constants";
import { GET_USER_LIQUIDITY, } from "./queries";

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

export interface INewMintOrBurnOperationData extends IMintOrBurnOperation {
  pair: IPairTokenSufficientData;
  sender: string;
  to: string;
  blockNumber: bigint;
  transaction: ITransactionMinimalData;
}

export interface INewLiquidityProvisionQueryResult {
  mints: INewMintOrBurnOperationData[];
  burns: INewMintOrBurnOperationData[];
}
