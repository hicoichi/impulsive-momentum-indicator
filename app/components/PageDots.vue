<!-- 控えめなページインジケーター。押すとその衝動へ移動する（USM US-B3・US-B6） -->
<script setup lang="ts">
defineProps<{
  labels: readonly string[]
  current: number
}>()

const emit = defineEmits<{
  select: [index: number]
}>()
</script>

<template>
  <div class="dots">
    <button
      v-for="(label, i) in labels"
      :key="label"
      type="button"
      class="dot"
      :class="{ on: i === current }"
      :aria-label="label"
      :aria-current="i === current ? 'true' : undefined"
      @click="emit('select', i)"
    >
      <span class="bar" />
    </button>
  </div>
</template>

<style scoped>
.dots {
  display: flex;
  gap: 2px;
}

.dot {
  appearance: none;
  border: 0;
  background: none;
  padding: 0;
  width: 34px;
  height: 40px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
}

.bar {
  display: block;
  width: 16px;
  height: 3px;
  background: currentColor;
  opacity: .3;
  transition: width .3s ease, opacity .3s ease;
}

.dot.on .bar {
  width: 30px;
  opacity: 1;
}
</style>
