<!-- 残り投票枠（ピップ）とメッセージ（USM US-D2・US-C3・US-E2・US-E4） -->
<script setup lang="ts">
import { computed } from 'vue'
import type { EffectVariant } from '../composables/useImpulseBoard'

const props = defineProps<{
  remaining: number
  limit: number
  showPips: boolean
  message: string
  /** 上限中に押されたときの揺れ。null なら揺らさない */
  shakeEffect: EffectVariant | null
}>()

const pips = computed(() => Array.from({ length: props.limit }, (_, i) => i < props.remaining))
</script>

<template>
  <div
    class="meter"
    :class="shakeEffect && `shake-${shakeEffect}`"
    aria-live="polite"
    data-testid="meter"
  >
    <span
      v-if="showPips"
      class="pips"
      aria-hidden="true"
      data-testid="pips"
    >
      <span
        v-for="(on, i) in pips"
        :key="i"
        class="pip"
        :class="{ on }"
      />
    </span>
    <span class="msg">{{ message }}</span>
  </div>
</template>

<style scoped>
.meter {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 22px;
}

.msg {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: .06em;
  opacity: .85;
}

.pips {
  display: flex;
  gap: 4px;
}

.pip {
  display: block;
  width: 5px;
  height: 16px;
  box-shadow: inset 0 0 0 1.5px currentColor;
  opacity: .4;
}

.pip.on {
  background: currentColor;
  opacity: 1;
}

.shake-a { animation: shake-a .36s ease; }
.shake-b { animation: shake-b .36s ease; }
@keyframes shake-a {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-7px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(2px); }
}
@keyframes shake-b {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-7px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(2px); }
}
</style>
