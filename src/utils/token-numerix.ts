import Decimal from "decimal.js";

export type TokensNumericalData = {
  symbol: string;
  amount: number | bigint | string;
  decimals: number;
};

export const evaluateTokenData = (data: TokensNumericalData) => ({
  symbol: data.symbol,
  amount: new Decimal(data.amount.toString()).div(10 ** data.decimals).toNumber(),
});
