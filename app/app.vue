<script setup lang="ts">
import MainScreen from './components/MainScreen.vue'
import { useVerificationConfig } from './composables/useVerificationConfig'

const config = useVerificationConfig()
</script>

<template>
  <MainScreen :config="config" />
</template>
