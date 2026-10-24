import { nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useLoopTrack } from '../../../app/composables/useLoopTrack'

const COUNT = 3

function setup() {
  const index = ref(0)
  const loop = useLoopTrack({
    count: COUNT,
    index,
    next: () => {
      index.value = (index.value + 1) % COUNT
    },
    prev: () => {
      index.value = (index.value - 1 + COUNT) % COUNT
    },
    goTo: (target) => {
      index.value = target
    },
  })
  return { index, loop }
}

/** .track 自身の transform のアニメーションが終わったことを知らせる */
function transitionEnd(loop: ReturnType<typeof useLoopTrack>, propertyName = 'transform') {
  const track = document.createElement('div')
  const event = new Event('transitionend') as TransitionEvent
  Object.defineProperty(event, 'propertyName', { value: propertyName })
  Object.defineProperty(event, 'target', { value: track })
  Object.defineProperty(event, 'currentTarget', { value: track })
  loop.onTransitionEnd(event)
}

describe('useLoopTrack（C-09）', () => {
  it('複製を含めて衝動の数 + 2 枚を並べ、最初の衝動は2枚目に置く', () => {
    const { loop } = setup()
    expect(loop.slotCount).toBe(COUNT + 2)
    expect(loop.position.value).toBe(1)
    expect(loop.translatePercent.value).toBeCloseTo(-100 / (COUNT + 2))
  })

  it('最後から次へ進むと最初の複製へ滑り、移動が終わるとアニメーションなしで本物の最初へ差し替える', () => {
    const { index, loop } = setup()
    loop.jump(COUNT - 1)
    loop.next()
    expect(index.value).toBe(0)
    expect(loop.position.value).toBe(COUNT + 1)
    expect(loop.animated.value).toBe(true)
    transitionEnd(loop)
    expect(loop.position.value).toBe(1)
    expect(loop.animated.value).toBe(false)
  })

  it('最初から前へ戻ると最後の複製へ滑り、移動が終わると本物の最後へ差し替える', () => {
    const { index, loop } = setup()
    loop.prev()
    expect(index.value).toBe(COUNT - 1)
    expect(loop.position.value).toBe(0)
    transitionEnd(loop)
    expect(loop.position.value).toBe(COUNT)
  })

  it('子要素や transform 以外のアニメーションの終了では差し替えない', () => {
    const { loop } = setup()
    loop.prev()
    transitionEnd(loop, 'opacity')
    expect(loop.position.value).toBe(0)
  })

  it('複製の位置にいる間に操作されたら、差し替えを画面に反映してから動かす', async () => {
    const { index, loop } = setup()
    loop.prev()
    loop.next()
    // 差し替え（位置 0 → 3）はすぐ行い、移動は次の描画まで待つ
    expect(loop.position.value).toBe(COUNT)
    expect(loop.animated.value).toBe(false)
    await nextTick()
    await Promise.resolve()
    // 本物の最後から、最初の複製へ滑る
    expect(index.value).toBe(0)
    expect(loop.position.value).toBe(COUNT + 1)
    expect(loop.animated.value).toBe(true)
  })

  it('ドラッグを始める前に複製の位置を差し替える', () => {
    const { loop } = setup()
    loop.prev()
    expect(loop.settle()).toBe(true)
    expect(loop.position.value).toBe(COUNT)
    expect(loop.settle()).toBe(false)
  })
})
