// 予算アラートの設定を context から決める

import type { CostBudgetProps } from './cost-budget'

/** 予算の既定値（USD／月） */
export const DEFAULT_BUDGET_LIMIT_USD = 5

/** メールアドレスが指定されたときだけ予算アラートを作る。不正な値はエラーにする */
export function resolveBudget(email: unknown, limitUsd: unknown): CostBudgetProps | undefined {
  if (email === undefined) return undefined
  if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+$/.test(email)) {
    throw new Error('budgetEmail にはメールアドレスを指定してください')
  }
  const limit = limitUsd === undefined ? DEFAULT_BUDGET_LIMIT_USD : Number(limitUsd)
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error('budgetLimitUsd には正の数を指定してください')
  }
  return { email, limitUsd: limit }
}
