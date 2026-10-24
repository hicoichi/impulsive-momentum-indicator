// 票の保存先の境界。本番は DynamoDB（dynamo-vote-store.ts）、テストはメモリ上の実装を使う

import type { ImpulseKey } from '../../../app/domain/impulse'
import type { CastVote } from '../../../app/domain/vote'

/** あるセッションの、ある衝動への投票記録 */
export interface SessionVotes {
  votes: CastVote[]
  /** 楽観的ロック用の版。記録がなければ 0 */
  version: number
}

export interface CommitVoteInput {
  sid: string
  impulse: ImpulseKey
  /** 更新後の投票記録（ウィンドウ外の票は除いたもの） */
  votes: CastVote[]
  /** 読み取ったときの版。保存時に一致しなければ競合 */
  expectedVersion: number
  /** セッションの記録を TTL で消してよい時刻（エポック秒） */
  sessionExpiresAt: number
  /** 加算する集計の枠の開始時刻 */
  bucketStart: number
  /** 集計の枠を TTL で消してよい時刻（エポック秒） */
  bucketExpiresAt: number
}

export type CommitVoteResult = 'committed' | 'conflict'

export interface VoteStore {
  /** セッションの全衝動の投票記録 */
  getSessionVotes(sid: string): Promise<Record<ImpulseKey, SessionVotes>>
  /** セッションの記録の更新と、集計の加算を1つのトランザクションで行う */
  commitVote(input: CommitVoteInput): Promise<CommitVoteResult>
  /** 指定した枠以降の票数の合計 */
  sumCounts(impulse: ImpulseKey, fromBucket: number): Promise<number>
}
