<script setup lang="ts">
import MainScreen from './components/MainScreen.vue'
import { useApiBaseUrl } from './composables/useApiBaseUrl'
import { useVerificationConfig } from './composables/useVerificationConfig'

const config = useVerificationConfig()
const apiBaseUrl = useApiBaseUrl()
</script>

<template>
  <MainScreen
    :config="config"
    :api-base-url="apiBaseUrl"
  />
</template>
