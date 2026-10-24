// API の公開範囲と流量上限（USM T-08 で決定した値）

import type { Stage } from './stage'

/** 画面（GitHub Pages）のオリジン */
export const PAGES_ORIGIN = 'https://hicoichi.github.io'

/** 開発サーバー（npm run dev）のオリジン。dev ステージだけで許可する */
export const DEV_SERVER_ORIGIN = 'http://localhost:3000'

export function allowedOrigins(stage: Stage): string[] {
  return stage === 'dev' ? [PAGES_ORIGIN, DEV_SERVER_ORIGIN] : [PAGES_ORIGIN]
}

export interface ThrottleLimit {
  /** 1秒あたりの平均リクエスト数 */
  rateLimit: number
  /** 瞬間的に受け付けるリクエスト数 */
  burstLimit: number
}

/** ルートごとの流量上限。最悪の月額はおおむね POST /votes の値で決まる */
export const ROUTE_THROTTLES = {
  'GET /counts': { rateLimit: 10, burstLimit: 20 },
  'POST /votes': { rateLimit: 10, burstLimit: 30 },
  'POST /sessions': { rateLimit: 2, burstLimit: 5 },
  'GET /sessions/me': { rateLimit: 10, burstLimit: 20 },
} as const satisfies Record<string, ThrottleLimit>

export type RouteKey = keyof typeof ROUTE_THROTTLES

/** ルート以外（CORS の事前確認など）に適用する既定の上限 */
export const DEFAULT_THROTTLE: ThrottleLimit = { rateLimit: 10, burstLimit: 20 }

/** CloudFront で集計数をキャッシュする秒数 */
export const COUNTS_CACHE_SECONDS = 5

/** 署名用の鍵を置く SSM パラメーター名。SecureString は CloudFormation で作れないため、デプロイ前に手作業で作る */
export function signingKeyParameterName(stage: Stage): string {
  return `/impulsive-momentum-indicator/${stage}/session-signing-key`
}
