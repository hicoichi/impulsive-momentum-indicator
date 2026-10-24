// メイン画面の状態と操作：表示中の衝動、集計数、投票、上限、模擬変動の反映

import { computed, ref, shallowRef } from 'vue'
import type { ImpulseCountSource } from '../data/countSource'
import { createImpulseRecord, IMPULSE_COUNT, IMPULSE_KEYS, type ImpulseKey } from '../domain/impulse'
import type { RandomSource } from '../domain/simulation'
import { hasReachedLimit, remainingVotes } from '../domain/vote'

/** 他ユーザー分を更新する間隔（モック：1秒） */
export const TICK_INTERVAL_MS = 1000

export const MESSAGE_FIRST_VOTE = '絵を押して、1票'
export const MESSAGE_LIMIT = 'いまは、ここまで'

/** 直近の操作に対する演出の種類 */
export type BoardEffect = 'vote' | 'limit' | null

/** 同じ演出を連続で再生し直すため、A/B の2つのクラスを交互に付ける */
export type EffectVariant = 'a' | 'b'

export function effectVariant(count: number): EffectVariant {
  return count % 2 ? 'a' : 'b'
}

export interface ImpulseBoardOptions {
  source: ImpulseCountSource
  now?: () => number
  random?: RandomSource
}

function clampIndex(index: number): number {
  return Math.max(0, Math.min(IMPULSE_COUNT - 1, index))
}

function impulseAt(index: number): ImpulseKey {
  return IMPULSE_KEYS[clampIndex(index)] ?? IMPULSE_KEYS[0]
}

function createVoteId(at: number, sequence: number, random: RandomSource): string {
  return `v${at.toString(36)}-${sequence.toString(36)}-${random().toString(36).slice(2, 8)}`
}

export function useImpulseBoard(options: ImpulseBoardOptions) {
  const { source } = options
  const now = options.now ?? Date.now
  const random = options.random ?? Math.random

  const index = ref(0)
  const snapshot = shallowRef(source.read(now()))
  // 確定待ちの票がある衝動。確定までの間も自分の票として数える（楽観的更新）
  const pendingKey = ref<ImpulseKey | null>(null)
  const hasVoted = ref(false)
  const effect = ref<BoardEffect>(null)
  // 同じ演出を連続で再生し直すための通し番号
  const effectCount = ref(0)
  // 表示中の衝動の集計数が模擬変動で変わった回数
  const liveCount = ref(0)
  // 同じ時刻・同じ乱数でも票 ID が重ならないようにする通し番号
  let voteSequence = 0

  const currentKey = computed(() => impulseAt(index.value))

  const used = computed(() => createImpulseRecord(
    key => snapshot.value.mine[key] + (pendingKey.value === key ? 1 : 0),
  ))

  // 集計数をまだ取得できていない衝動は null
  const counts = computed(() => createImpulseRecord<number | null>((key) => {
    const others = snapshot.value.others
    return others ? others[key] + used.value[key] : null
  }))

  const remaining = computed(() => remainingVotes(used.value[currentKey.value]))
  const capped = computed(() => remaining.value === 0)

  const message = computed(() => {
    if (capped.value) return MESSAGE_LIMIT
    return hasVoted.value ? '' : MESSAGE_FIRST_VOTE
  })

  function refresh(): void {
    snapshot.value = source.read(now())
  }

  function trigger(kind: Exclude<BoardEffect, null>): void {
    effect.value = kind
    effectCount.value++
  }

  function tick(): void {
    const key = currentKey.value
    const before = counts.value[key]
    source.advance(now())
    refresh()
    if (counts.value[key] !== before) liveCount.value++
  }

  function goTo(target: number): void {
    index.value = clampIndex(target)
    effect.value = null
  }

  async function vote(): Promise<void> {
    // 確定待ちの間は重ねて受け付けない
    if (pendingKey.value) return
    const key = currentKey.value
    refresh()
    if (hasReachedLimit(snapshot.value.mine[key])) {
      trigger('limit')
      return
    }
    const voteId = createVoteId(now(), voteSequence++, random)
    pendingKey.value = key
    hasVoted.value = true
    trigger('vote')
    try {
      const result = await source.submitVote(key, voteId)
      if (!result.ok) trigger('limit')
    }
    catch {
      // 通信に失敗した票は数えない。確定待ちを外すと、押した瞬間の +1 も元に戻る
      effect.value = null
    }
    finally {
      pendingKey.value = null
      refresh()
    }
  }

  let timer: ReturnType<typeof setInterval> | undefined

  function start(): void {
    stop()
    timer = setInterval(tick, TICK_INTERVAL_MS)
  }

  function stop(): void {
    if (timer !== undefined) clearInterval(timer)
    timer = undefined
  }

  return {
    index,
    currentKey,
    counts,
    remaining,
    capped,
    message,
    effect,
    effectCount,
    liveCount,
    goTo,
    next: () => goTo(index.value + 1),
    prev: () => goTo(index.value - 1),
    vote,
    tick,
    start,
    stop,
  }
}
