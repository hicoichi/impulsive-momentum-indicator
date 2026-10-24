<!-- 1つの衝動のスライド：エンブレム（＝投票ボタン）、ラベル、集計数 -->
<script setup lang="ts">
import { computed, type Component } from 'vue'
import type { EffectVariant } from '../composables/useImpulseBoard'
import type { ImpulseDefinition, ImpulseKey } from '../domain/impulse'
import { formatCount } from '../domain/format'
import EmblemExodus from './emblems/EmblemExodus.vue'
import EmblemFestival from './emblems/EmblemFestival.vue'
import EmblemIkki from './emblems/EmblemIkki.vue'
import EmblemRevolution from './emblems/EmblemRevolution.vue'

const props = defineProps<{
  impulse: ImpulseDefinition
  count: number
  active: boolean
  capped: boolean
  /** 投票の演出。null なら再生しない */
  voteEffect: EffectVariant | null
  /** 模擬変動のライブ点。null なら光らせない */
  liveEffect: EffectVariant | null
}>()

const emit = defineEmits<{
  vote: []
}>()

const EMBLEMS: Record<ImpulseKey, Component> = {
  ikki: EmblemIkki,
  revolution: EmblemRevolution,
  exodus: EmblemExodus,
  festival: EmblemFestival,
}

const formattedCount = computed(() => formatCount(props.count))
const voteLabel = computed(() => `${props.impulse.label}（${formattedCount.value}票）に1票を投じる`)
</script>

<template>
  <section
    class="slide"
    :aria-hidden="active ? 'false' : 'true'"
    :aria-label="impulse.label"
  >
    <button
      type="button"
      class="emblem"
      :class="[voteEffect && `jolt-${voteEffect}`, { capped }]"
      :tabindex="active ? 0 : -1"
      :aria-label="voteLabel"
      :aria-disabled="capped ? 'true' : 'false'"
      @click="emit('vote')"
    >
      <component :is="EMBLEMS[impulse.key]" />
    </button>
    <h2 class="label">
      {{ impulse.label }}
    </h2>
    <div class="countwrap">
      <span
        class="live"
        :class="liveEffect && `live-${liveEffect}`"
        :style="{ background: impulse.theme.accent }"
      />
      <span
        class="count"
        :class="voteEffect && `bump-${voteEffect}`"
        data-testid="count"
      >{{ formattedCount }}</span>
      <span
        class="plus"
        :class="voteEffect && `plus-${voteEffect}`"
        :style="{ color: impulse.theme.accent }"
        aria-hidden="true"
      >+1</span>
    </div>
  </section>
</template>

<style scoped>
.slide {
  width: 25%;
  height: 100%;
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(8px, 2.2cqh, 22px);
  padding: 8px 24px;
  box-sizing: border-box;
}

.emblem {
  appearance: none;
  border: 0;
  margin: 0;
  padding: 0;
  background: none;
  color: inherit;
  font: inherit;
  display: block;
  cursor: pointer;
  border-radius: 28px;
  touch-action: pan-y;
  transition: transform .15s ease, opacity .3s ease, filter .3s ease;
}

.emblem:hover {
  transform: scale(1.02);
}

.emblem:active {
  transform: scale(.96);
}

.emblem.capped {
  opacity: .5;
  filter: saturate(.35);
  cursor: not-allowed;
}

.emblem.capped:hover,
.emblem.capped:active {
  transform: none;
}

.emblem :deep(svg) {
  display: block;
  width: min(80cqw, 50cqh, 440px);
  height: auto;
  overflow: hidden;
}

.label {
  margin: 0;
  font-family: 'Dela Gothic One', 'IBM Plex Sans JP', sans-serif;
  font-weight: 400;
  font-size: clamp(30px, min(9.5cqw, 6.4cqh), 60px);
  line-height: 1.1;
  letter-spacing: .03em;
  text-align: center;
}

.countwrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.count {
  display: inline-block;
  font-family: 'IBM Plex Mono', monospace;
  font-weight: 600;
  font-size: clamp(46px, min(17cqw, 11cqh), 120px);
  line-height: 1;
  letter-spacing: -.04em;
  font-variant-numeric: tabular-nums;
}

.plus {
  position: absolute;
  left: 100%;
  top: -6px;
  margin-left: 8px;
  font-family: 'IBM Plex Mono', monospace;
  font-weight: 600;
  font-size: clamp(20px, 5cqw, 30px);
  opacity: 0;
  pointer-events: none;
  white-space: nowrap;
}

.live {
  position: absolute;
  right: 100%;
  top: 50%;
  margin: -4px 14px 0 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  opacity: .3;
}

/* 投票の演出：エンブレムの揺れ */
.jolt-a { animation: jolt-a .6s cubic-bezier(.2, .8, .2, 1); }
.jolt-b { animation: jolt-b .6s cubic-bezier(.2, .8, .2, 1); }
@keyframes jolt-a {
  0% { transform: scale(1); }
  12% { transform: scale(1.09) rotate(-2.5deg); }
  28% { transform: scale(.97) rotate(2deg); }
  46% { transform: scale(1.03) rotate(-1deg); }
  100% { transform: scale(1); }
}
@keyframes jolt-b {
  0% { transform: scale(1); }
  12% { transform: scale(1.09) rotate(-2.5deg); }
  28% { transform: scale(.97) rotate(2deg); }
  46% { transform: scale(1.03) rotate(-1deg); }
  100% { transform: scale(1); }
}

/* 投票の演出：集計数の拡大 */
.bump-a { animation: bump-a .4s ease-out; }
.bump-b { animation: bump-b .4s ease-out; }
@keyframes bump-a {
  0% { transform: scale(1); }
  30% { transform: scale(1.1); }
  100% { transform: scale(1); }
}
@keyframes bump-b {
  0% { transform: scale(1); }
  30% { transform: scale(1.1); }
  100% { transform: scale(1); }
}

/* 投票の演出：「+1」が浮かんで消える */
.plus-a { animation: plus-a 1s cubic-bezier(.2, .7, .2, 1) forwards; }
.plus-b { animation: plus-b 1s cubic-bezier(.2, .7, .2, 1) forwards; }
@keyframes plus-a {
  0% { opacity: 0; transform: translateY(10px); }
  15% { opacity: 1; transform: translateY(0); }
  65% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-26px); }
}
@keyframes plus-b {
  0% { opacity: 0; transform: translateY(10px); }
  15% { opacity: 1; transform: translateY(0); }
  65% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-26px); }
}

/* 模擬変動のライブ点 */
.live-a { animation: live-a .9s ease-out; }
.live-b { animation: live-b .9s ease-out; }
@keyframes live-a {
  0% { opacity: 1; transform: scale(1.5); }
  100% { opacity: .3; transform: scale(1); }
}
@keyframes live-b {
  0% { opacity: 1; transform: scale(1.5); }
  100% { opacity: .3; transform: scale(1); }
}
</style>
