import type { AppContext } from '@/types'

// biome-ignore lint/suspicious/noExplicitAny: require generic to return any type
export function success(context: AppContext, data: any) {
  return context.json({ success: true, ...data })
}

export function error(context: AppContext, error: string) {
  return context.json({ success: false, error })
}
