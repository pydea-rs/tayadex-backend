import { error } from '@/responses'
import { type IPairTokenData, getPools } from '@/services'
import {
  type AppContext,
  ERROR_ADDRESS_TOKEN,
  ERROR_MULTIPLE_AMOUNT,
  ERROR_NON_VALID_TOKEN,
  ERROR_NO_AMOUNT,
  ERROR_TOKENS_EQUAL,
  ERROR_ZERO_AMOUNT,
  TradeDirection
} from '@/types'
import { findBestRoute } from '@/utils'
import { OpenAPIRoute } from 'chanfana'
import { formatUnits, isAddress, parseUnits } from 'viem'
import { z } from 'zod'

export class GetQuote extends OpenAPIRoute {
  schema = {
    request: {
      query: z.object({
        fromToken: z.string().describe('The address of the token the user wants to sell.'),
        toToken: z.string().describe('The address of the token the user wants to receive.'),
        fromAmount: z
          .string()
          .optional()
          .describe(
            'The amount of tokens the user wants to sell. Either fromAmount or toAmount must be specified, but not both.'
          ),
        toAmount: z
          .string()
          .optional()
          .describe(
            'The amount of tokens the user wants to receive. Either toAmount or fromAmount must be specified, but not both.'
          )
      })
    },
    response: {
      '200': {
        success: z.boolean().describe('Indicates whether the request was successful.'),
        error: z.string().optional().describe('Error message if the request failed.'),
        quote: z
          .string()
          .optional()
          .describe(
            'The amount of tokens received for the given fromToken, toToken, and specified fromAmount or toAmount.'
          ),
        route: z
          .array(z.string())
          .optional()
          .describe('Optimal trading path (token addresses) for the requested trade.'),
        priceImpact: z.string().optional().describe('The percentage impact of the trade on the pool'),
        suggestedSlippage: z.string().optional().describe('The suggested slippage to use.')
      }
    },
    description: 'Returns the quote and optimal trading path for exchanging a specified amount of tokens.',
    tags: ['Quote']
  }

  async handle(context: AppContext) {
    let {
      query: { fromToken, fromAmount, toToken, toAmount }
    } = await this.getValidatedData<typeof this.schema>()

    fromToken = fromToken.toLowerCase()
    toToken = toToken.toLowerCase()

    if (!fromAmount && !toAmount) {
      return error(context, ERROR_NO_AMOUNT)
    }

    if (fromAmount && toAmount) {
      return error(context, ERROR_MULTIPLE_AMOUNT)
    }

    if (fromToken === toToken) {
      return error(context, ERROR_TOKENS_EQUAL)
    }

    if (!isAddress(fromToken)) {
      return error(context, ERROR_ADDRESS_TOKEN('fromToken'))
    }

    if (!isAddress(toToken)) {
      return error(context, ERROR_ADDRESS_TOKEN('toToken'))
    }

    const pools = await getPools(context)

    const tokens: Record<string, IPairTokenData> = pools.reduce(
      (acc, pair) => {
        const token0Key = pair.token0.id.toLowerCase()
        const token1Key = pair.token1.id.toLowerCase()
        if (!acc[token0Key]) {
          acc[token0Key] = pair.token0
        }
        if (!acc[token1Key]) {
          acc[token1Key] = pair.token1
        }
        return acc
      },
      {} as Record<string, IPairTokenData>
    )

    const tokenIn = tokens[fromToken]
    const tokenOut = tokens[toToken]

    if (!tokenIn) {
      return error(context, ERROR_NON_VALID_TOKEN('fromToken'))
    }

    if (!tokenOut) {
      return error(context, ERROR_NON_VALID_TOKEN('toToken'))
    }

    const amount: bigint = fromAmount
      ? parseUnits(fromAmount, Number(tokenIn.decimals))
      : toAmount
        ? parseUnits(toAmount, Number(tokenOut.decimals))
        : 0n

    if (amount === 0n) {
      return error(context, ERROR_ZERO_AMOUNT)
    }

    const direction = fromAmount ? TradeDirection.ExactInput : TradeDirection.ExactOutput

    const {
      route,
      output,
      priceImpact: priceImpactNumber,
      suggestedSlippage: suggestedSlippageNumber
    } = await findBestRoute(amount, tokenIn.id, tokenOut.id, pools, direction)

    const quote = fromAmount
      ? formatUnits(output, Number(tokenIn.decimals))
      : formatUnits(output, Number(tokenOut.decimals))

    const priceImpact = (priceImpactNumber * 100).toFixed(3)
    const suggestedSlippage = (suggestedSlippageNumber * 100).toFixed(3)

    return context.json({
      success: true,
      route,
      quote,
      priceImpact,
      suggestedSlippage
    })
  }
}
