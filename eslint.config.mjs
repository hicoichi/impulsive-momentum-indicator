// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // 生成物とモック HTML は対象外
  { ignores: ['*.html', 'playwright-report/**', 'test-results/**'] },
)
