import { describe, expect, it } from 'vitest'
import { MOCK_INITIAL_OTHER_COUNTS } from '../../../app/data/mockInitialCounts'
import { VOTE_WINDOWS_MS } from '../../../app/domain/vote'
import { createClock, createTestSource } from '../helpers'

describe('モックの模擬サーバー', () => {
  it('US-A2・Q-12: 初期値はモックの値で、自分の票は0', () => {
    const clock = createClock()
    const source = createTestSource({ now: clock.now })
    const snap = source.read(clock.now())
    expect(snap.others).toEqual(MOCK_INITIAL_OTHER_COUNTS)
    expect(snap.mine).toEqual({ ikki: 0, revolution: 0, exodus: 0, festival: 0 })
  })

  it('US-E1: 10票目は受け付け、11票目は拒否する', async () => {
    const clock = createClock()
    const source = createTestSource({ now: clock.now })
    for (let i = 1; i <= 10; i++) {
      expect(await source.submitVote('ikki', `v${i}`)).toEqual({ ok: true, duplicate: false })
    }
    expect(await source.submitVote('ikki', 'v11')).toEqual({ ok: false, reason: 'limit' })
    expect(source.read(clock.now()).mine.ikki).toBe(10)
  })

  it('US-E1: 上限は衝動ごとに独立している', async () => {
    const clock = createClock()
    const source = createTestSource({ now: clock.now })
    for (let i = 0; i < 10; i++) await source.submitVote('ikki', `i${i}`)
    expect(await source.submitVote('revolution', 'r0')).toEqual({ ok: true, duplicate: false })
    expect(source.read(clock.now()).mine).toMatchObject({ ikki: 10, revolution: 1 })
  })

  it('US-E3・Q-13: 12時間で自分の票が外れ、枠が回復する', async () => {
    const clock = createClock()
    const source = createTestSource({ now: clock.now })
    for (let i = 0; i < 10; i++) await source.submitVote('ikki', `v${i}`)
    clock.advance(VOTE_WINDOWS_MS['12h'])
    expect(source.read(clock.now()).mine.ikki).toBe(0)
    expect(await source.submitVote('ikki', 'again')).toEqual({ ok: true, duplicate: false })
  })

  it('US-V3: 同じ票 ID は1票としてしか記録しない', async () => {
    const clock = createClock()
    const source = createTestSource({ now: clock.now })
    await source.submitVote('exodus', 'same')
    expect(await source.submitVote('exodus', 'same')).toEqual({ ok: true, duplicate: true })
    expect(source.read(clock.now()).mine.exodus).toBe(1)
  })

  it('US-V3: 二重送信の模擬が起きても1票しか増えない', async () => {
    const clock = createClock()
    // 乱数 0 で必ず二重送信が起きる
    const source = createTestSource({ now: clock.now, random: () => 0 })
    expect(await source.submitVote('festival', 'v1')).toEqual({ ok: true, duplicate: false })
    expect(source.read(clock.now()).mine.festival).toBe(1)
  })

  it('US-D3: advance で他ユーザー分が模擬変動し、自分の票は消えない', async () => {
    const clock = createClock()
    // 流入と失効で異なる乱数を返し、値が必ず動くようにする
    let calls = 0
    const source = createTestSource({ now: clock.now, random: () => (calls++ % 2 === 0 ? 0.99999 : 0) })
    await source.submitVote('ikki', 'v1')
    source.advance(clock.now())
    const snap = source.read(clock.now())
    expect(snap.others.ikki).not.toBe(MOCK_INITIAL_OTHER_COUNTS.ikki)
    expect(snap.mine.ikki).toBe(1)
  })
})
