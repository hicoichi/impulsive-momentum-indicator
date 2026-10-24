// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint'],
  devtools: { enabled: true },
  app: {
    head: {
      htmlAttrs: { lang: 'ja' },
      title: '世界の空気を、衝動で測る。',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans+JP:wght@500;700&display=swap',
        },
      ],
    },
  },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      // 検証用の設定（USM US-V1・V2）。ビルド時の環境変数
      // NUXT_PUBLIC_VOTE_WINDOW／NUXT_PUBLIC_SHOW_PIPS でだけ上書きする。
      // 公開用ビルドでは設定せず、この既定値で動かす。
      voteWindow: '12h',
      showPips: true,
    },
  },
  compatibilityDate: '2026-10-24',
  eslint: {
    config: {
      stylistic: true,
    },
  },
})
