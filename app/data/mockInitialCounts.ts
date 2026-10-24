// モックの初期値（他ユーザー分）。実際の集計結果ではない（USM Q-12）。

import type { ImpulseKey } from '../domain/impulse'

export const MOCK_INITIAL_OTHER_COUNTS: Readonly<Record<ImpulseKey, number>> = {
  ikki: 123456,
  revolution: 234567,
  exodus: 345678,
  festival: 456789,
}
