export const ERROR_NO_AMOUNT = 'The quote request requires an amount; neither "fromAmount" nor "toAmount" was provided.'

export const ERROR_MULTIPLE_AMOUNT = 'The quote request requires either "fromAmount" or "toAmount", but not both.'

export const ERROR_ADDRESS_TOKEN = (token: 'fromToken' | 'toToken') => `The "${token}" address is invalid`

export const ERROR_TOKENS_EQUAL = 'The "fromToken" and "toToken" parameters cannot be the same.'

export const ERROR_NON_VALID_TOKEN = (token: 'fromToken' | 'toToken') => `The "${token}" is not a valid token address.`

export const ERROR_ZERO_AMOUNT = 'Unable to obtain a quote for a zero input amount.'

export const ERROR_TASK_INVALID = 'Task tried to verify is invalid.'

export const ERROR_ADDRESS_INVALID = 'The address provided is invalid.'

export const ERROR_TASK_COMPLETE = 'The task is not complete.'
