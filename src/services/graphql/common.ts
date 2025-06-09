export interface ISingleTokenMinimalData {
  symbol: string;
}

export interface IPairTokenMinimalData {
  id: number;
  token0: ISingleTokenMinimalData;
  token1: ISingleTokenMinimalData;
}

export interface ISingleTokenData {
  decimals: string;
  id: string;
  name: string;
  symbol: string;
}

export interface IPairTokenData {
  id: string
  reserve0: string
  reserve1: string
  token0: ISingleTokenData
  token1: ISingleTokenData
  totalSupply: string
  volumeUSD: string
  reserveUSD: string
}