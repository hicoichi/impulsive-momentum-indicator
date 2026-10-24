import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// ドメイン層・データ層・composable・コンポーネントの単体テスト。
// Nuxt に依存しないコードだけを対象にし、Nuxt の起動なしで動かす。
export default defineConfig({
  plugins: [vue()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'happy-dom',
  },
})
