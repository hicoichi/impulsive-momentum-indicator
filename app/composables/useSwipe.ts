// 横スワイプ／ドラッグによる切替（USM US-B1）。数値はモックに合わせている。
// 端から端へループするため（USM C-09）、端での抵抗はかけない

import { ref } from 'vue'

/** これ以上動いたらドラッグとみなす */
const DRAG_START_PX = 8
/** 切り替えの閾値：min(80px, 表示幅 × 18%) */
const SWITCH_MAX_PX = 80
const SWITCH_WIDTH_RATIO = 0.18
/** 表示幅が取れないときの代わりの幅 */
const FALLBACK_WIDTH_PX = 390
/** ドラッグ直後のクリックを投票とみなさない時間 */
const CLICK_SUPPRESS_MS = 350

/** この属性を持つ要素から始まった操作はスワイプとして扱わない */
export const SWIPE_IGNORE_ATTR = 'data-swipe-ignore'

interface DragState {
  startX: number
  width: number
  element: HTMLElement
  pointerId: number
  moved: boolean
}

export interface SwipeOptions {
  next: () => void
  prev: () => void
  /** ドラッグが始まったときに呼ぶ */
  onDragStart?: () => void
  now?: () => number
}

export function useSwipe(options: SwipeOptions) {
  const now = options.now ?? Date.now
  const offset = ref(0)
  const dragging = ref(false)
  let drag: DragState | null = null
  let suppressClickUntil = 0

  function onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return
    const target = event.target
    if (target instanceof Element && target.closest(`[${SWIPE_IGNORE_ATTR}]`)) return
    const element = event.currentTarget
    if (!(element instanceof HTMLElement)) return
    drag = {
      startX: event.clientX,
      width: element.clientWidth || FALLBACK_WIDTH_PX,
      element,
      pointerId: event.pointerId,
      moved: false,
    }
  }

  function onPointerMove(event: PointerEvent): void {
    if (!drag) return
    const dx = event.clientX - drag.startX
    if (!drag.moved) {
      if (Math.abs(dx) < DRAG_START_PX) return
      drag.moved = true
      options.onDragStart?.()
      try {
        drag.element.setPointerCapture(drag.pointerId)
      }
      catch {
        // ポインターがすでに離れている場合は捕捉できないが、ドラッグは続けられる
      }
    }
    offset.value = dx
    dragging.value = true
  }

  function reset(): void {
    offset.value = 0
    dragging.value = false
  }

  function onPointerUp(): void {
    const current = drag
    drag = null
    if (!current?.moved) return
    suppressClickUntil = now() + CLICK_SUPPRESS_MS
    const threshold = Math.min(SWITCH_MAX_PX, current.width * SWITCH_WIDTH_RATIO)
    const dx = offset.value
    reset()
    if (dx < -threshold) options.next()
    else if (dx > threshold) options.prev()
  }

  /** ドラッグ直後のクリックか */
  function isClickSuppressed(): boolean {
    return now() < suppressClickUntil
  }

  return {
    offset,
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    isClickSuppressed,
  }
}
