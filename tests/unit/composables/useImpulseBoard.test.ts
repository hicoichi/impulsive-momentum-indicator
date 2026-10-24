import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MESSAGE_FIRST_VOTE, MESSAGE_LIMIT, TICK_INTERVAL_MS, useImpulseBoard } from '../../../app/composables/useImpulseBoard'
import { createMockCountSource } from '../../../app/data/mockCountSource'
import { MOCK_INITIAL_OTHER_COUNTS } from '../../../app/data/mockInitialCounts'
import { IMPULSE_COUNT } from '../../../app/domain/impulse'
import { VOTE_WINDOWS_MS } from '../../../app/domain/vote'
import { createClock, createTestSource } from '../helpers'

function setup(options: { random?: () => number } = {}) {
  const clock = createClock()
  const random = options.random ?? (() => 0.5)
  const source = createTestSource({ now: clock.now, random })
  const board = useImpulseBoard({ source, now: clock.now, random })
  return { clock, source, board }
}

async function voteTimes(board: ReturnType<typeof useImpulseBoard>, times: number) {
  for (let i = 0; i < times; i++) await board.vote()
}

describe('useImpulseBoard', () => {
  it('US-A1: 初期表示は「一揆したい」で、集計数はモックの初期値', () => {
    const { board } = setup()
    expect(board.currentKey.value).toBe('ikki')
    expect(board.counts.value.ikki).toBe(MOCK_INITIAL_OTHER_COUNTS.ikki)
  })

  it('US-B1・Q-09: 端でループしない', () => {
    const { board } = setup()
    board.prev()
    expect(board.index.value).toBe(0)
    const last = IMPULSE_COUNT - 1
    board.goTo(last)
    board.next()
    expect(board.index.value).toBe(last)
    expect(board.currentKey.value).toBe('festival')
  })

  it('US-C1・US-D1: 投票すると表示中の衝動だけが +1 される', async () => {
    const { board } = setup()
    await board.vote()
    expect(board.counts.value.ikki).toBe(MOCK_INITIAL_OTHER_COUNTS.ikki + 1)
    expect(board.counts.value.exodus).toBe(MOCK_INITIAL_OTHER_COUNTS.exodus)
    expect(board.effect.value).toBe('vote')
  })

  it('US-D1: 押した瞬間に +1 され、確定後も巻き戻らない（楽観的更新）', async () => {
    vi.useFakeTimers()
    try {
      const clock = createClock()
      const source = createMockCountSource({ windowMs: VOTE_WINDOWS_MS['12h'], now: clock.now, random: () => 0.5 })
      const board = useImpulseBoard({ source, now: clock.now, random: () => 0.5 })
      const pending = board.vote()
      expect(board.counts.value.ikki).toBe(MOCK_INITIAL_OTHER_COUNTS.ikki + 1)
      // 確定待ちの間に重ねて押しても加算されない
      await board.vote()
      expect(board.counts.value.ikki).toBe(MOCK_INITIAL_OTHER_COUNTS.ikki + 1)
      await vi.advanceTimersByTimeAsync(140)
      await pending
      expect(board.counts.value.ikki).toBe(MOCK_INITIAL_OTHER_COUNTS.ikki + 1)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('US-D1: 切り替えて戻っても増えた値が維持される', async () => {
    const { board } = setup()
    await board.vote()
    board.next()
    board.prev()
    expect(board.counts.value.ikki).toBe(MOCK_INITIAL_OTHER_COUNTS.ikki + 1)
  })

  it('US-C3: 初回はガイドを表示し、どれかに1回投票すると消える', async () => {
    const { board } = setup()
    expect(board.message.value).toBe(MESSAGE_FIRST_VOTE)
    board.goTo(2)
    await board.vote()
    expect(board.message.value).toBe('')
    board.goTo(0)
    expect(board.message.value).toBe('')
  })

  it('US-D2: 残り枠は投票ごとに1減り、衝動ごとに独立', async () => {
    const { board } = setup()
    expect(board.remaining.value).toBe(10)
    await voteTimes(board, 3)
    expect(board.remaining.value).toBe(7)
    board.next()
    expect(board.remaining.value).toBe(10)
  })

  it('US-E1・US-E2・US-E4: 10票で上限。11票目は数が増えず、上限の演出とメッセージになる', async () => {
    const { board } = setup()
    await voteTimes(board, 10)
    expect(board.capped.value).toBe(true)
    expect(board.message.value).toBe(MESSAGE_LIMIT)
    const before = board.counts.value.ikki
    await board.vote()
    expect(board.counts.value.ikki).toBe(before)
    expect(board.effect.value).toBe('limit')
    board.next()
    expect(board.capped.value).toBe(false)
  })

  it('US-E3: 12時間経過すると集計数が減り、上限が解ける', async () => {
    const { board, clock } = setup()
    await voteTimes(board, 10)
    clock.advance(VOTE_WINDOWS_MS['12h'])
    board.tick()
    expect(board.capped.value).toBe(false)
    expect(board.remaining.value).toBe(10)
    expect(board.counts.value.ikki).toBe(MOCK_INITIAL_OTHER_COUNTS.ikki)
  })

  it('通信に失敗した票は数えず、押した瞬間の +1 を元に戻す', async () => {
    const clock = createClock()
    const failing = createTestSource({ now: clock.now })
    failing.submitVote = () => Promise.reject(new Error('network'))
    const board = useImpulseBoard({ source: failing, now: clock.now, random: () => 0.5 })
    await board.vote()
    expect(board.counts.value.ikki).toBe(MOCK_INITIAL_OTHER_COUNTS.ikki)
    expect(board.remaining.value).toBe(10)
    expect(board.effect.value).toBeNull()
  })

  it('集計数をまだ取得できていなければ null', () => {
    const clock = createClock()
    const source = createTestSource({ now: clock.now })
    const read = source.read.bind(source)
    source.read = at => ({ ...read(at), others: null })
    const board = useImpulseBoard({ source, now: clock.now })
    expect(board.counts.value.ikki).toBeNull()
  })

  it('切り替えると演出が解除される', async () => {
    const { board } = setup()
    await board.vote()
    board.next()
    expect(board.effect.value).toBeNull()
  })

  describe('US-D3: 模擬変動', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('1秒ごとに他ユーザー分が変動し、表示中の値が変わるとライブ点が光る', () => {
      let calls = 0
      const { board } = setup({ random: () => (calls++ % 2 === 0 ? 0.99999 : 0) })
      board.start()
      vi.advanceTimersByTime(TICK_INTERVAL_MS)
      expect(board.counts.value.ikki).not.toBe(MOCK_INITIAL_OTHER_COUNTS.ikki)
      expect(board.liveCount.value).toBe(1)
      board.stop()
      vi.advanceTimersByTime(TICK_INTERVAL_MS * 5)
      expect(board.liveCount.value).toBe(1)
    })

    it('値が変わらなければライブ点は光らない', () => {
      const { board } = setup()
      board.tick()
      expect(board.liveCount.value).toBe(0)
    })
  })
})
