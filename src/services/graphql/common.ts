export interface ISingleTokenMinimalData {
  symbol: string;
}

export interface ISingleTokenSufficientData extends ISingleTokenMinimalData {
  decimals: number;
}
export interface IPairTokenMinimalData {
  id: number;
  token0: ISingleTokenMinimalData;
  token1: ISingleTokenMinimalData;
}

export interface IPairTokenSufficientData {
  id: number;
  token0: ISingleTokenSufficientData;
  token1: ISingleTokenSufficientData;
}

export interface ISingleTokenData extends ISingleTokenSufficientData {
  id: string;
  name: string;
}

export interface IPairTokenData {
  id: string;
  reserve0: string;
  reserve1: string;
  token0: ISingleTokenData;
  token1: ISingleTokenData;
  totalSupply: string;
  volumeUSD: string;
  reserveUSD: string;
}

export interface ITransactionMinimalData {
  id: string; // TODO: Check if this is id or hash
}
