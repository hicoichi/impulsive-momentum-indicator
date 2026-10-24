import { bucketExpiresAt, bucketStart, COUNT_BUCKET_MS, firstBucketInWindow } from '../../lambda/api/buckets'
import { bucketKey } from '../../lambda/api/dynamo-vote-store'

const HOUR = 60 * 60 * 1000
const WINDOW = 12 * HOUR

describe('集計の5分枠', () => {
  test('枠は5分', () => {
    expect(COUNT_BUCKET_MS).toBe(5 * 60 * 1000)
  })

  test('時刻は属する枠の開始時刻にそろえる', () => {
    expect(bucketStart(COUNT_BUCKET_MS * 10 + 1)).toBe(COUNT_BUCKET_MS * 10)
    expect(bucketStart(COUNT_BUCKET_MS * 11 - 1)).toBe(COUNT_BUCKET_MS * 10)
  })

  test('ウィンドウの始点を含む枠から集計する（最大5分遅れて外れる）', () => {
    const now = 100 * HOUR + 2 * 60 * 1000
    expect(firstBucketInWindow(now, WINDOW)).toBe(bucketStart(now - WINDOW))
    expect(firstBucketInWindow(now, WINDOW)).toBeLessThanOrEqual(now - WINDOW)
    expect(now - WINDOW - firstBucketInWindow(now, WINDOW)).toBeLessThan(COUNT_BUCKET_MS)
  })

  test('枠は集計に使われなくなった後に消える', () => {
    const start = 100 * HOUR
    expect(bucketExpiresAt(start, WINDOW) * 1000).toBeGreaterThan(start + WINDOW + COUNT_BUCKET_MS)
  })

  test('枠のキーは文字列の順序が時刻の順序と一致する', () => {
    const keys = [9 * COUNT_BUCKET_MS, 10 * COUNT_BUCKET_MS, 1_800_000_000_000].map(bucketKey)
    expect([...keys].sort()).toEqual(keys)
  })
})
