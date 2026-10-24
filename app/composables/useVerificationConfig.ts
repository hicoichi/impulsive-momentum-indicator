// 検証用の設定（USM US-V1・V2）を runtimeConfig から読む。読み取りはここだけで行う

import { parseVerificationConfig, type VerificationConfig } from '../domain/verificationConfig'

export function useVerificationConfig(): VerificationConfig {
  const config = useRuntimeConfig().public
  return parseVerificationConfig({
    voteWindow: config.voteWindow,
    showPips: config.showPips,
  })
}
