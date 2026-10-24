// 検証用の設定（USM US-V1・V2）の値を検証する。不正な値は既定値に倒す。

import { DEFAULT_VOTE_WINDOW, VOTE_WINDOWS_MS, type VoteWindow } from './vote'

export interface VerificationConfig {
  voteWindow: VoteWindow
  showPips: boolean
}

export const DEFAULT_VERIFICATION_CONFIG: VerificationConfig = {
  voteWindow: DEFAULT_VOTE_WINDOW,
  showPips: true,
}

function isVoteWindow(value: unknown): value is VoteWindow {
  return typeof value === 'string' && Object.hasOwn(VOTE_WINDOWS_MS, value)
}

/** 環境変数は文字列でも真偽値でも届きうるため、両方を受け付ける */
function parseShowPips(value: unknown): boolean {
  if (value === false || value === 'false') return false
  return DEFAULT_VERIFICATION_CONFIG.showPips
}

export function parseVerificationConfig(raw: { voteWindow?: unknown, showPips?: unknown }): VerificationConfig {
  return {
    voteWindow: isVoteWindow(raw.voteWindow) ? raw.voteWindow : DEFAULT_VERIFICATION_CONFIG.voteWindow,
    showPips: parseShowPips(raw.showPips),
  }
}
