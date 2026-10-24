// テスト用のメモリ上の VoteStore。版の一致を確かめ、DynamoDB と同じく競合を返す

import { createImpulseRecord, type ImpulseKey } from '../../../app/domain/impulse'
import type { CommitVoteInput, CommitVoteResult, SessionVotes, VoteStore } from '../../lambda/api/vote-store'

export class MemoryVoteStore implements VoteStore {
  readonly sessions = new Map<string, Record<ImpulseKey, SessionVotes>>()
  /** `${衝動}#${枠の開始時刻}` → 票数 */
  readonly buckets = new Map<string, number>()
  /** 次の commitVote で強制的に競合させる回数 */
  forcedConflicts = 0

  async getSessionVotes(sid: string) {
    const stored = this.sessions.get(sid)
    return createImpulseRecord<SessionVotes>(key => ({
      votes: [...(stored?.[key].votes ?? [])],
      version: stored?.[key].version ?? 0,
    }))
  }

  async commitVote(input: CommitVoteInput): Promise<CommitVoteResult> {
    if (this.forcedConflicts > 0) {
      this.forcedConflicts--
      return 'conflict'
    }
    const session = this.sessions.get(input.sid) ?? createImpulseRecord<SessionVotes>(() => ({ votes: [], version: 0 }))
    if (session[input.impulse].version !== input.expectedVersion) return 'conflict'
    session[input.impulse] = { votes: [...input.votes], version: input.expectedVersion + 1 }
    this.sessions.set(input.sid, session)
    const key = `${input.impulse}#${input.bucketStart}`
    this.buckets.set(key, (this.buckets.get(key) ?? 0) + 1)
    return 'committed'
  }

  async sumCounts(impulse: ImpulseKey, fromBucket: number) {
    let total = 0
    for (const [key, votes] of this.buckets) {
      const [bucketImpulse, start] = key.split('#')
      if (bucketImpulse === impulse && Number(start) >= fromBucket) total += votes
    }
    return total
  }
}
