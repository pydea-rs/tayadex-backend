export function getAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  const feeNumerator = 997n

  const feeDenom = 1000n

  const amountInWithFee = amountIn * feeNumerator

  const numerator = amountInWithFee * reserveOut

  const denominator = reserveIn * feeDenom + amountInWithFee

  return numerator / denominator
}

export function getAmountIn(amountOut: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  const feeNumerator = 997n

  const feeDenom = 1000n

  return (reserveIn * amountOut * feeDenom) / ((reserveOut - amountOut) * feeNumerator) + 1n
}
