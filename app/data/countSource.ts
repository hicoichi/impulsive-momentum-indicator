// 集計数の取得と投票の送信の境界。モック（mockCountSource.ts）と AWS（apiCountSource.ts）の実装がある。

import type { ImpulseKey } from '../domain/impulse'

export interface CountSnapshot {
  /** 他ユーザー分の有効票数。まだ取得できていなければ null */
  others: Record<ImpulseKey, number> | null
  /** 自分の有効票数（確定済みのもの） */
  mine: Record<ImpulseKey, number>
}

export type VoteResult
  = | { ok: true, duplicate: boolean }
    | { ok: false, reason: 'limit' }

export interface ImpulseCountSource {
  /** 現在の集計の材料を返す。ウィンドウから外れた自分の票は含めない */
  read(now: number): CountSnapshot
  /** 時間経過を反映する */
  advance(now: number): void
  /** 票を送り、確定したら結果を返す。同じ voteId の票は1票としてしか数えない。通信に失敗したら例外を投げる */
  submitVote(key: ImpulseKey, voteId: string): Promise<VoteResult>
}
