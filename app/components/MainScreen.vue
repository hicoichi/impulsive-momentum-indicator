<!-- メイン画面：1画面に1つの衝動を大きく表示し、横に切り替えて投票する -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { effectVariant, useImpulseBoard } from '../composables/useImpulseBoard'
import { SWIPE_IGNORE_ATTR, useSwipe } from '../composables/useSwipe'
import { createMockCountSource } from '../data/mockCountSource'
import { IMPULSE_COUNT, IMPULSE_KEYS, IMPULSES } from '../domain/impulse'
import type { VerificationConfig } from '../domain/verificationConfig'
import { VOTE_LIMIT, VOTE_WINDOWS_MS } from '../domain/vote'
import ImpulseSlide from './ImpulseSlide.vue'
import PageDots from './PageDots.vue'
import VoteMeter from './VoteMeter.vue'

const props = defineProps<{
  config: VerificationConfig
}>()

const board = useImpulseBoard({
  source: createMockCountSource({ windowMs: VOTE_WINDOWS_MS[props.config.voteWindow] }),
})
const { index, currentKey, counts, remaining, capped, message, effect, effectCount, liveCount } = board

const swipe = useSwipe({ index, count: IMPULSE_COUNT, goTo: board.goTo })
const { offset, dragging } = swipe

const labels = IMPULSE_KEYS.map(key => IMPULSES[key].label)
const theme = computed(() => IMPULSES[currentKey.value].theme)

const variant = computed(() => effectVariant(effectCount.value))
const voteEffect = computed(() => (effect.value === 'vote' ? variant.value : null))
const shakeEffect = computed(() => (effect.value === 'limit' ? variant.value : null))
const liveEffect = computed(() => (liveCount.value > 0 ? effectVariant(liveCount.value) : null))

const trackStyle = computed(() => ({
  transform: `translateX(calc(${-index.value * 25}% + ${offset.value}px))`,
  transition: dragging.value ? 'none' : 'transform .5s cubic-bezier(.2, .8, .2, 1)',
}))

const swipeIgnore = { [SWIPE_IGNORE_ATTR]: '' }

function onVote(): void {
  if (swipe.isClickSuppressed()) return
  void board.vote()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    board.prev()
  }
  else if (event.key === 'ArrowRight') {
    event.preventDefault()
    board.next()
  }
}

onMounted(board.start)
onBeforeUnmount(board.stop)
</script>

<template>
  <div
    class="root"
    tabindex="0"
    aria-label="衝動を選んで投票する"
    :style="{ background: theme.background, color: theme.foreground }"
    @keydown="onKeydown"
  >
    <header class="head">
      <span class="tagline">世界の空気を、衝動で測る。</span>
      <span
        class="badge"
        data-testid="simulation-badge"
      >SIMULATION<br>仮の数値・模擬更新</span>
    </header>

    <div
      class="stage"
      @pointerdown="swipe.onPointerDown"
      @pointermove="swipe.onPointerMove"
      @pointerup="swipe.onPointerUp"
      @pointercancel="swipe.onPointerUp"
    >
      <div
        class="track"
        :style="trackStyle"
      >
        <ImpulseSlide
          v-for="(key, i) in IMPULSE_KEYS"
          :key="key"
          :impulse="IMPULSES[key]"
          :count="counts[key]"
          :active="i === index"
          :capped="capped"
          :vote-effect="i === index ? voteEffect : null"
          :live-effect="i === index ? liveEffect : null"
          @vote="onVote"
        />
        <div
          class="flash"
          :class="voteEffect && `flash-${voteEffect}`"
        />
      </div>
      <button
        type="button"
        class="arrow l"
        v-bind="swipeIgnore"
        :disabled="index === 0"
        aria-label="前の衝動"
        @click="board.prev"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          aria-hidden="true"
        ><polyline points="15,4 7,12 15,20" /></svg>
      </button>
      <button
        type="button"
        class="arrow r"
        v-bind="swipeIgnore"
        :disabled="index === IMPULSE_COUNT - 1"
        aria-label="次の衝動"
        @click="board.next"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          aria-hidden="true"
        ><polyline points="9,4 17,12 9,20" /></svg>
      </button>
    </div>

    <footer class="foot">
      <VoteMeter
        :remaining="remaining"
        :limit="VOTE_LIMIT"
        :show-pips="config.showPips"
        :message="message"
        :shake-effect="shakeEffect"
      />
      <PageDots
        :labels="labels"
        :current="index"
        @select="board.goTo"
      />
    </footer>
  </div>
</template>

<style scoped>
.root {
  width: 100%;
  height: 100vh;
  height: 100dvh;
  min-height: 560px;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  outline: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: background-color .5s ease, color .5s ease;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 18px 20px 0;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  box-sizing: border-box;
}

.tagline {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: .06em;
}

.badge {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  letter-spacing: .08em;
  line-height: 1.3;
  padding: 4px 8px;
  box-shadow: inset 0 0 0 1px currentColor;
  text-align: right;
  opacity: .85;
}

.stage {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  overflow: hidden;
  touch-action: pan-y;
  container-type: size;
  cursor: grab;
}

.track {
  display: flex;
  width: 400%;
  height: 100%;
  position: relative;
}

.flash {
  position: absolute;
  left: 0;
  right: 0;
  top: -15px;
  bottom: 0;
  background: currentColor;
  opacity: 0;
  pointer-events: none;
}

.flash-a { animation: flash-a .45s ease-out; }
.flash-b { animation: flash-b .45s ease-out; }
@keyframes flash-a {
  0% { opacity: .2; }
  100% { opacity: 0; }
}
@keyframes flash-b {
  0% { opacity: .2; }
  100% { opacity: 0; }
}

.arrow {
  position: absolute;
  top: 50%;
  margin-top: -28px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 0;
  box-shadow: inset 0 0 0 1.5px currentColor;
  background: transparent;
  color: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: .7;
  transition: opacity .2s;
}

.arrow:hover {
  opacity: 1;
}

.arrow:disabled {
  opacity: .15;
  cursor: default;
}

.arrow.l {
  left: 32px;
}

.arrow.r {
  right: 32px;
}

/* 狭い画面ではスワイプで切り替えるため、矢印を出さない */
@container (max-width: 700px) {
  .arrow {
    display: none;
  }
}

.foot {
  width: 100%;
  max-width: 460px;
  margin: 0 auto;
  padding: 0 20px 24px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
</style>
