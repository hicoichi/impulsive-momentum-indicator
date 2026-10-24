import { createMockCountSource } from '../../app/data/mockCountSource'
import type { RandomSource } from '../../app/domain/simulation'
import { VOTE_WINDOWS_MS } from '../../app/domain/vote'

/** 時刻を手で進められる時計 */
export function createClock(start = 1_000_000) {
  let current = start
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms
    },
  }
}

/**
 * テスト用のモックソース。遅延なしで即座に確定し、乱数は固定する。
 * random が 0.5 のとき、模擬変動は流入と失効が釣り合い、二重送信も起きない。
 */
export function createTestSource(options: { now: () => number, random?: RandomSource, windowMs?: number }) {
  return createMockCountSource({
    windowMs: options.windowMs ?? VOTE_WINDOWS_MS['12h'],
    now: options.now,
    random: options.random ?? (() => 0.5),
    delay: () => Promise.resolve(),
  })
}
