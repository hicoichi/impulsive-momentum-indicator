// バックエンドの URL を runtimeConfig から読む。ビルド時の環境変数 NUXT_PUBLIC_API_BASE_URL で指定する

import { parseApiBaseUrl } from '../data/createCountSource'

export function useApiBaseUrl(): string | null {
  return parseApiBaseUrl(useRuntimeConfig().public.apiBaseUrl)
}
