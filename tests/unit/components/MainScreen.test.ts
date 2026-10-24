import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MainScreen from '../../../app/components/MainScreen.vue'
import { MOCK_ACK_DELAY_MS } from '../../../app/data/mockCountSource'
import type { VerificationConfig } from '../../../app/domain/verificationConfig'

const DEFAULT_CONFIG: VerificationConfig = { voteWindow: '12h', showPips: true }

let wrapper: VueWrapper | undefined

function render(config: VerificationConfig = DEFAULT_CONFIG) {
  wrapper = mount(MainScreen, { props: { config }, attachTo: document.body })
  return wrapper
}

function slides(w: VueWrapper) {
  return w.findAll('section.slide')
}

function activeSlide(w: VueWrapper) {
  const found = slides(w).find(s => s.attributes('aria-hidden') === 'false')
  if (!found) throw new Error('表示中のスライドがない')
  return found
}

async function voteOnce(w: VueWrapper) {
  await activeSlide(w).find('button.emblem').trigger('click')
  await vi.advanceTimersByTimeAsync(MOCK_ACK_DELAY_MS)
}

beforeEach(() => {
  // 模擬変動（1秒ごと）が起きない範囲で時間を進める
  vi.useFakeTimers()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

describe('MainScreen', () => {
  it('US-A4・US-A3: コンセプト文と模擬データのバッジを表示する', () => {
    const w = render()
    expect(w.text()).toContain('世界の空気を、衝動で測る。')
    expect(w.get('[data-testid="simulation-badge"]').text()).toBe('SIMULATION仮の数値・模擬更新')
  })

  it('US-A1: 表示中の衝動は1つだけで、初期は「一揆したい」とモックの初期値', () => {
    const w = render()
    expect(slides(w)).toHaveLength(4)
    expect(slides(w).filter(s => s.attributes('aria-hidden') === 'false')).toHaveLength(1)
    const active = activeSlide(w)
    expect(active.get('h2').text()).toBe('一揆したい')
    expect(active.get('[data-testid="count"]').text()).toBe('123,456')
  })

  it('US-C1: 専用の投票ボタンはなく、エンブレムが投票ボタンになっている', () => {
    const w = render()
    expect(w.findAll('button').some(b => b.text().includes('投じる'))).toBe(false)
    const emblem = activeSlide(w).get('button.emblem')
    expect(emblem.attributes('aria-label')).toBe('一揆したい（123,456票）に1票を投じる')
    expect(emblem.attributes('tabindex')).toBe('0')
    const hidden = slides(w).filter(s => s.attributes('aria-hidden') === 'true')
    expect(hidden.every(s => s.get('button.emblem').attributes('tabindex') === '-1')).toBe(true)
  })

  it('US-D1・US-C2: エンブレムを押すとすぐに +1 され、演出のクラスが付く', async () => {
    const w = render()
    await activeSlide(w).get('button.emblem').trigger('click')
    expect(activeSlide(w).get('[data-testid="count"]').text()).toBe('123,457')
    expect(activeSlide(w).get('button.emblem').classes().some(c => c.startsWith('jolt-'))).toBe(true)
    await vi.advanceTimersByTimeAsync(MOCK_ACK_DELAY_MS)
    expect(activeSlide(w).get('[data-testid="count"]').text()).toBe('123,457')
  })

  it('US-B5: ← → キーで切り替わり、テーマ色も変わる', async () => {
    const w = render()
    const root = w.get('.root')
    expect(root.attributes('style')).toContain('background: #C42A1C')
    await root.trigger('keydown', { key: 'ArrowRight' })
    expect(activeSlide(w).get('h2').text()).toBe('革命したい')
    expect(root.attributes('style')).toContain('background: #141212')
    await root.trigger('keydown', { key: 'ArrowLeft' })
    expect(activeSlide(w).get('h2').text()).toBe('一揆したい')
  })

  it('US-B2: 矢印ボタンで切り替わり、端では無効になる', async () => {
    const w = render()
    const prev = w.get('button[aria-label="前の衝動"]')
    const next = w.get('button[aria-label="次の衝動"]')
    expect(prev.attributes('disabled')).toBeDefined()
    for (let i = 0; i < 3; i++) await next.trigger('click')
    expect(activeSlide(w).get('h2').text()).toBe('祭りたい')
    expect(next.attributes('disabled')).toBeDefined()
    expect(prev.attributes('disabled')).toBeUndefined()
  })

  it('US-B3・US-B6: インジケーターで現在位置がわかり、押すと移動する', async () => {
    const w = render()
    const dots = w.findAll('button.dot')
    expect(dots).toHaveLength(4)
    expect(dots[0]?.classes()).toContain('on')
    await dots[2]?.trigger('click')
    expect(activeSlide(w).get('h2').text()).toBe('国外脱出したい')
    expect(w.findAll('button.dot')[2]?.classes()).toContain('on')
  })

  it('US-C3・US-D2: 初回ガイドとピップ。投票するとガイドが消え、ピップが減る', async () => {
    const w = render()
    const meter = () => w.get('[data-testid="meter"]')
    expect(meter().text()).toBe('絵を押して、1票')
    expect(meter().findAll('.pip.on')).toHaveLength(10)
    await voteOnce(w)
    expect(meter().text()).toBe('')
    expect(meter().findAll('.pip.on')).toHaveLength(9)
  })

  it('US-E1・US-E2・US-E4: 10票で上限の表示になり、それ以上押しても増えない', async () => {
    const w = render()
    for (let i = 0; i < 10; i++) await voteOnce(w)
    const emblem = activeSlide(w).get('button.emblem')
    expect(emblem.classes()).toContain('capped')
    expect(emblem.attributes('aria-disabled')).toBe('true')
    expect(w.get('[data-testid="meter"]').text()).toBe('いまは、ここまで')
    expect(w.get('[data-testid="meter"]').findAll('.pip.on')).toHaveLength(0)
    // 投票の確定待ちで1秒を超え、模擬変動が入るため、押す前後の値を比べる
    const before = activeSlide(w).get('[data-testid="count"]').text()
    await activeSlide(w).get('button.emblem').trigger('click')
    expect(activeSlide(w).get('[data-testid="count"]').text()).toBe(before)
    expect(w.get('[data-testid="meter"]').classes().some(c => c.startsWith('shake-'))).toBe(true)
  })

  it('US-V2: ピップ非表示の設定ではピップを出さず、メッセージは出す', () => {
    const w = render({ voteWindow: '12h', showPips: false })
    expect(w.find('[data-testid="pips"]').exists()).toBe(false)
    expect(w.get('[data-testid="meter"]').text()).toBe('絵を押して、1票')
  })
})
