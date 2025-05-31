import { error, success } from '@/responses'
import { fetchShmonSwaps } from '@/services'
import { type AppContext, ERROR_ADDRESS_INVALID, ERROR_TASK_COMPLETE, ERROR_TASK_INVALID } from '@/types'
import { OpenAPIRoute } from 'chanfana'
import { isAddress } from 'viem'
import { z } from 'zod'

const VALID_TASK_IDS = [6393]

export class GetTaskVerify extends OpenAPIRoute {
  schema = {
    request: {
      params: z.object({
        id: z.number().describe('ID of the task to verify')
      }),
      query: z.object({
        address: z.string().describe('The address of the user that wants to verify the task.')
      })
    },
    response: {
      '200': {
        success: z.boolean().describe('Indicates whether the task is done or not.')
      }
    },
    description: 'Returns if a user has finished a task based on the task id.',
    tags: ['Tasks']
  }

  async handle(context: AppContext) {
    const {
      params: { id },
      query: { address }
    } = await this.getValidatedData<typeof this.schema>()

    if (!VALID_TASK_IDS.includes(id)) {
      return error(context, ERROR_TASK_INVALID)
    }

    if (!isAddress(address)) {
      return error(context, ERROR_ADDRESS_INVALID)
    }

    if (id === 6393) {
      const swaps = await fetchShmonSwaps(address)

      let sum = 0

      for (let i = 0; i < swaps.length; i++) {
        sum += Number(swaps[i].amount0In)
        sum += Number(swaps[i].amount0Out)
      }

      return sum > 200 ? success(context, {}) : error(context, ERROR_TASK_COMPLETE)
    }

    return context.json({
      success: false
    })
  }
}
