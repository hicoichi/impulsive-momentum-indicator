// ブラウザ内だけで動く模擬サーバー。モックの挙動（USM §2.6）をそのまま再現する。
// 他ユーザー分は集計値だけを持ち、自分の票は投票時刻つきで持つ。状態はメモリのみ（Q-06）。

import { createImpulseRecord, IMPULSE_KEYS, type ImpulseKey } from '../domain/impulse'
import { driftCount, type RandomSource } from '../domain/simulation'
import { activeVotes, hasReachedLimit, type CastVote } from '../domain/vote'
import type { CountSnapshot, ImpulseCountSource, VoteResult } from './countSource'
import { MOCK_INITIAL_OTHER_COUNTS } from './mockInitialCounts'

/** 投票を受け付けてから確定するまでの模擬遅延 */
export const MOCK_ACK_DELAY_MS = 140

/** 同じ票を二重に送る確率（US-V3） */
export const MOCK_DUPLICATE_SEND_RATE = 0.3

export interface MockCountSourceOptions {
  windowMs: number
  now?: () => number
  random?: RandomSource
  delay?: (ms: number) => Promise<void>
  initialOthers?: Readonly<Record<ImpulseKey, number>>
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function createMockCountSource(options: MockCountSourceOptions): ImpulseCountSource {
  const { windowMs } = options
  const now = options.now ?? Date.now
  const random = options.random ?? Math.random
  const delay = options.delay ?? wait
  const initialOthers = options.initialOthers ?? MOCK_INITIAL_OTHER_COUNTS

  const others = createImpulseRecord(key => initialOthers[key])
  const mine = createImpulseRecord<CastVote[]>(() => [])
  // 受け付けた票 ID と時刻。ウィンドウを過ぎたら忘れる
  const seen = new Map<string, number>()

  function prune(at: number): void {
    for (const key of IMPULSE_KEYS) {
      mine[key] = activeVotes(mine[key], at, windowMs)
    }
    for (const [id, receivedAt] of seen) {
      if (at - receivedAt >= windowMs) seen.delete(id)
    }
  }

  function record(key: ImpulseKey, voteId: string, at: number): VoteResult {
    prune(at)
    if (seen.has(voteId)) return { ok: true, duplicate: true }
    if (hasReachedLimit(mine[key].length)) return { ok: false, reason: 'limit' }
    mine[key].push({ id: voteId, at })
    seen.set(voteId, at)
    return { ok: true, duplicate: false }
  }

  return {
    read(at: number): CountSnapshot {
      prune(at)
      return {
        others: { ...others },
        mine: createImpulseRecord(key => mine[key].length),
      }
    },

    advance(at: number): void {
      prune(at)
      for (const key of IMPULSE_KEYS) {
        others[key] = driftCount(others[key], random)
      }
    },

    async submitVote(key: ImpulseKey, voteId: string): Promise<VoteResult> {
      await delay(MOCK_ACK_DELAY_MS)
      const at = now()
      const result = record(key, voteId, at)
      // 通信の再送を模擬する。同じ ID なので記録は増えない
      if (random() < MOCK_DUPLICATE_SEND_RATE) record(key, voteId, at)
      return result
    },
  }
}
