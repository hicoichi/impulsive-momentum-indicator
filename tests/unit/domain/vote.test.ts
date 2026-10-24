import { describe, expect, it } from 'vitest'
import { activeVotes, hasReachedLimit, remainingVotes, VOTE_LIMIT, VOTE_WINDOWS_MS } from '../../../app/domain/vote'

const HOUR = 60 * 60 * 1000
const WINDOW = VOTE_WINDOWS_MS['12h']

describe('activeVotes', () => {
  it('US-E3: 投票からちょうど12時間で集計対象外になる', () => {
    const votes = [{ id: 'a', at: 0 }]
    expect(activeVotes(votes, WINDOW - 1, WINDOW)).toHaveLength(1)
    expect(activeVotes(votes, WINDOW, WINDOW)).toHaveLength(0)
  })

  it('US-E1: 最後の投票からではなく、票ごとに12時間で外れる（ローリングウィンドウ）', () => {
    const votes = [
      { id: 'a', at: 0 },
      { id: 'b', at: 6 * HOUR },
    ]
    const active = activeVotes(votes, 12 * HOUR, WINDOW)
    expect(active.map(v => v.id)).toEqual(['b'])
  })

  it('US-V1: 60秒のウィンドウでは60秒で外れる', () => {
    const window60s = VOTE_WINDOWS_MS['60s']
    const votes = [{ id: 'a', at: 0 }]
    expect(activeVotes(votes, 59_999, window60s)).toHaveLength(1)
    expect(activeVotes(votes, 60_000, window60s)).toHaveLength(0)
  })
})

describe('上限', () => {
  it('上限は10票', () => {
    expect(VOTE_LIMIT).toBe(10)
  })

  it('US-E1: 9票までは上限に達していない。10票で上限', () => {
    expect(hasReachedLimit(9)).toBe(false)
    expect(hasReachedLimit(10)).toBe(true)
  })

  it('US-D2: 残り投票枠は 0 未満にならない', () => {
    expect(remainingVotes(0)).toBe(10)
    expect(remainingVotes(3)).toBe(7)
    expect(remainingVotes(10)).toBe(0)
    expect(remainingVotes(12)).toBe(0)
  })
})
