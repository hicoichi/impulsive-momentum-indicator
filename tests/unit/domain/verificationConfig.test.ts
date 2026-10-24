import { describe, expect, it } from 'vitest'
import { parseVerificationConfig } from '../../../app/domain/verificationConfig'
import { formatCount } from '../../../app/domain/format'

describe('parseVerificationConfig（US-V1・V2）', () => {
  it('未設定なら既定値（12h、ピップ表示）', () => {
    expect(parseVerificationConfig({})).toEqual({ voteWindow: '12h', showPips: true })
  })

  it('60s とピップ非表示を受け付ける', () => {
    expect(parseVerificationConfig({ voteWindow: '60s', showPips: 'false' })).toEqual({ voteWindow: '60s', showPips: false })
    expect(parseVerificationConfig({ showPips: false }).showPips).toBe(false)
  })

  it('不正な値は既定値に倒す', () => {
    expect(parseVerificationConfig({ voteWindow: '1h', showPips: 'no' })).toEqual({ voteWindow: '12h', showPips: true })
    expect(parseVerificationConfig({ voteWindow: 'toString' }).voteWindow).toBe('12h')
  })
})

describe('formatCount（US-A2）', () => {
  it('3桁カンマ区切りにする', () => {
    expect(formatCount(123456)).toBe('123,456')
    expect(formatCount(1234567)).toBe('1,234,567')
    expect(formatCount(0)).toBe('0')
  })
})
