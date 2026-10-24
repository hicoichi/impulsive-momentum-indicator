// 端から端へループするスライドの表示位置（USM C-09）
//
// 両端に複製を置き、[最後の複製, 衝動1, …, 衝動n, 最初の複製] と並べる。
// 最後から次へ進むときは「最初の複製」へ滑らせ、移動が終わったらアニメーションなしで本物の最初へ差し替える。
// こうすると、端をまたぐときも全スライドを逆戻りせず、隣へ移るように見える。

import { computed, nextTick, ref, type Ref } from 'vue'

export interface LoopTrackOptions {
  /** 衝動の数（複製を含まない） */
  count: number
  /** 表示中の衝動の位置（0 始まり） */
  index: Ref<number>
  next: () => void
  prev: () => void
  goTo: (index: number) => void
}

export function useLoopTrack(options: LoopTrackOptions) {
  const { count } = options
  /** 複製を含めた並びでの表示位置。0 と count + 1 が複製 */
  const position = ref(options.index.value + 1)
  /** 位置の変化をアニメーションさせるか */
  const animated = ref(true)
  const trackElement = ref<HTMLElement | null>(null)

  /** 複製の位置にいたら、アニメーションなしで本物の位置へ差し替える。差し替えたら true */
  function settle(): boolean {
    if (position.value === 0) position.value = count
    else if (position.value === count + 1) position.value = 1
    else return false
    animated.value = false
    return true
  }

  /**
   * 複製の位置にいたら本物へ差し替え、それを画面に反映させてから move を行う。
   * 同じフレームで差し替えと移動をすると、差し替え前の位置から逆戻りして見えるため。
   * 差し替えが要らなければ、待たずにすぐ行う
   */
  function afterSettled(move: () => void): void {
    if (!settle()) {
      move()
      return
    }
    void nextTick().then(() => {
      void trackElement.value?.offsetWidth
      move()
    })
  }

  function step(direction: 1 | -1): void {
    afterSettled(() => {
      if (direction === 1) options.next()
      else options.prev()
      position.value += direction
      animated.value = true
    })
  }

  function jump(target: number): void {
    afterSettled(() => {
      options.goTo(target)
      position.value = options.index.value + 1
      animated.value = true
    })
  }

  function onTransitionEnd(event: TransitionEvent): void {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return
    settle()
  }

  /** スライド1枚ぶんの移動量（.track の幅に対する割合） */
  const slotPercent = 100 / (count + 2)
  const translatePercent = computed(() => -position.value * slotPercent)

  return {
    position,
    animated,
    trackElement,
    /** ドラッグを始める前に呼ぶ */
    settle,
    next: () => step(1),
    prev: () => step(-1),
    jump,
    onTransitionEnd,
    translatePercent,
    /** 複製を含めたスライドの枚数 */
    slotCount: count + 2,
  }
}
