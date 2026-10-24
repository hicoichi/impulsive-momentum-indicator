// 集計の5分枠。集計数は直近12時間に含まれる枠の合計で求める（USM T-08）

/** 集計の枠の長さ */
export const COUNT_BUCKET_MS = 5 * 60 * 1000

/** 時刻が属する枠の開始時刻 */
export function bucketStart(at: number): number {
  return Math.floor(at / COUNT_BUCKET_MS) * COUNT_BUCKET_MS
}

/**
 * 集計に含める最初の枠の開始時刻。
 * ウィンドウの始点を含む枠から含めるため、票は最大5分遅れて集計から外れる。
 */
export function firstBucketInWindow(now: number, windowMs: number): number {
  return bucketStart(now - windowMs)
}

/** 枠の項目を DynamoDB の TTL で消してよい時刻（エポック秒）。集計に使われなくなってから少し余裕を持たせる */
export function bucketExpiresAt(start: number, windowMs: number): number {
  return Math.ceil((start + windowMs + 2 * COUNT_BUCKET_MS) / 1000)
}
