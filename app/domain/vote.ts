// 投票の上限とローリングウィンドウの判定（USM US-E1・US-E3）

/** 1ユーザー × 1衝動あたり、ウィンドウ内に投じられる票数の上限 */
export const VOTE_LIMIT = 10

/** 集計ウィンドウ。`60s` は検証用（US-V1） */
export const VOTE_WINDOWS_MS = {
  '12h': 12 * 60 * 60 * 1000,
  '60s': 60 * 1000,
} as const

export type VoteWindow = keyof typeof VOTE_WINDOWS_MS

export const DEFAULT_VOTE_WINDOW: VoteWindow = '12h'

export interface CastVote {
  id: string
  /** 投票時刻（エポックミリ秒） */
  at: number
}

/**
 * ウィンドウ内に残っている票だけを返す。
 * 投票からちょうど windowMs 経過した票は対象外にする。
 */
export function activeVotes(votes: readonly CastVote[], now: number, windowMs: number): CastVote[] {
  return votes.filter(vote => now - vote.at < windowMs)
}

/** 残り投票枠 */
export function remainingVotes(activeCount: number, limit: number = VOTE_LIMIT): number {
  return Math.max(0, limit - activeCount)
}

export function hasReachedLimit(activeCount: number, limit: number = VOTE_LIMIT): boolean {
  return activeCount >= limit
}
