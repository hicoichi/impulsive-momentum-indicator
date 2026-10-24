// 集計の材料をどこから取るかを決める。API の URL が指定されていれば AWS、なければモック

import type { VoteWindow } from '../domain/vote'
import { VOTE_WINDOWS_MS } from '../domain/vote'
import { createApiCountSource } from './apiCountSource'
import type { ImpulseCountSource } from './countSource'
import { createMockCountSource } from './mockCountSource'

/**
 * API の URL を検証する。https か、開発用の localhost だけを受け付け、末尾の / は取り除く。
 * 空や不正な値は null（モックで動く）
 */
export function parseApiBaseUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value.trim())
    const isLocal = url.protocol === 'http:' && url.hostname === 'localhost'
    if (url.protocol !== 'https:' && !isLocal) return null
    return url.toString().replace(/\/+$/, '')
  }
  catch {
    return null
  }
}

export function createCountSource(options: { apiBaseUrl: string | null, voteWindow: VoteWindow }): ImpulseCountSource {
  if (options.apiBaseUrl) return createApiCountSource({ baseUrl: options.apiBaseUrl })
  // 検証用の集計ウィンドウ（US-V1）はモックだけで使う。サーバーは常に12時間
  return createMockCountSource({ windowMs: VOTE_WINDOWS_MS[options.voteWindow] })
}
