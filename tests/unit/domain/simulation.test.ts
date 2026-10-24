import { describe, expect, it } from 'vitest'
import { driftCount } from '../../../app/domain/simulation'

describe('driftCount（US-D3 他ユーザー分の模擬変動）', () => {
  it('流入と失効が同じ揺らぎなら値は変わらない', () => {
    expect(driftCount(432000, () => 0.5)).toBe(432000)
  })

  it('流入が多ければ増え、失効が多ければ減る', () => {
    // rate = 432000 / 43200 = 10。流入 round(10 × 1.7)=17、失効 round(10 × 0.3)=3
    const seq = [0.99999, 0]
    expect(driftCount(432000, () => seq.shift() ?? 0)).toBe(432000 + 17 - 3)
    const seq2 = [0, 0.99999]
    expect(driftCount(432000, () => seq2.shift() ?? 0)).toBe(432000 + 3 - 17)
  })

  it('0 未満にならない', () => {
    expect(driftCount(0, () => 0.9)).toBe(0)
  })
})
