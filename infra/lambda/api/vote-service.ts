// 集計・残り投票枠・投票の処理。上限とウィンドウの判定は app/domain を使う

import { createImpulseRecord, IMPULSE_KEYS, type ImpulseKey } from '../../../app/domain/impulse'
import { activeVotes, hasReachedLimit, remainingVotes, type CastVote } from '../../../app/domain/vote'
import { bucketExpiresAt, bucketStart, firstBucketInWindow } from './buckets'
import type { SessionVotes, VoteStore } from './vote-store'

/** 楽観的ロックの競合時に読み直す回数 */
const MAX_COMMIT_ATTEMPTS = 3

export interface VoteServiceDeps {
  store: VoteStore
  now: () => number
  windowMs: number
}

export type ImpulseCounts = Record<ImpulseKey, number>

export type CastVoteResult
  = | { status: 'accepted' | 'duplicate', remaining: ImpulseCounts }
    | { status: 'limit', remaining: ImpulseCounts }

export class VoteConflictError extends Error {
  constructor() {
    super('投票の保存が競合し続けたため中断した')
  }
}

export async function getCounts(deps: VoteServiceDeps): Promise<ImpulseCounts> {
  const from = firstBucketInWindow(deps.now(), deps.windowMs)
  const totals = await Promise.all(IMPULSE_KEYS.map(key => deps.store.sumCounts(key, from)))
  return createImpulseRecord(key => totals[IMPULSE_KEYS.indexOf(key)] ?? 0)
}

function remainingOf(all: Record<ImpulseKey, SessionVotes>, now: number, windowMs: number): ImpulseCounts {
  return createImpulseRecord(key => remainingVotes(activeVotes(all[key].votes, now, windowMs).length))
}

export async function getRemaining(deps: VoteServiceDeps, sid: string): Promise<ImpulseCounts> {
  const all = await deps.store.getSessionVotes(sid)
  return remainingOf(all, deps.now(), deps.windowMs)
}

/** 最後の票が集計から外れた後に、セッションの記録を消してよい時刻（エポック秒） */
function sessionExpiresAt(votes: readonly CastVote[], windowMs: number): number {
  const latest = Math.max(...votes.map(vote => vote.at))
  return Math.ceil((latest + windowMs) / 1000)
}

export async function castVote(
  deps: VoteServiceDeps,
  sid: string,
  impulse: ImpulseKey,
  voteId: string,
): Promise<CastVoteResult> {
  for (let attempt = 0; attempt < MAX_COMMIT_ATTEMPTS; attempt++) {
    const all = await deps.store.getSessionVotes(sid)
    const now = deps.now()
    const current = all[impulse]
    const active = activeVotes(current.votes, now, deps.windowMs)

    // 再送された票は記録済みとして扱い、二重に数えない
    if (active.some(vote => vote.id === voteId)) {
      return { status: 'duplicate', remaining: remainingOf(all, now, deps.windowMs) }
    }
    if (hasReachedLimit(active.length)) {
      return { status: 'limit', remaining: remainingOf(all, now, deps.windowMs) }
    }

    const votes = [...active, { id: voteId, at: now }]
    const start = bucketStart(now)
    const result = await deps.store.commitVote({
      sid,
      impulse,
      votes,
      expectedVersion: current.version,
      sessionExpiresAt: sessionExpiresAt(votes, deps.windowMs),
      bucketStart: start,
      bucketExpiresAt: bucketExpiresAt(start, deps.windowMs),
    })
    if (result === 'committed') {
      const updated = { ...all, [impulse]: { votes, version: current.version + 1 } }
      return { status: 'accepted', remaining: remainingOf(updated, now, deps.windowMs) }
    }
  }
  throw new VoteConflictError()
}
