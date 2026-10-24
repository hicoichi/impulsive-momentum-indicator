// HTTP API のルーティングと入出力の検証。AWS には依存せず、テストから直接呼べる
//
// | ルート              | 認証               | 内容                                   |
// |---------------------|--------------------|----------------------------------------|
// | GET /counts         | なし               | 衝動ごとの集計数（CloudFront で数秒キャッシュ） |
// | POST /sessions      | なし               | 匿名セッションの発行                    |
// | GET /sessions/me    | X-Session-Token    | 残り投票枠。トークンを延長して返す       |
// | POST /votes         | X-Session-Token    | 投票。トークンを延長して返す             |

import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { createImpulseRecord, IMPULSE_KEYS, type ImpulseKey } from '../../../app/domain/impulse'
import { VOTE_LIMIT } from '../../../app/domain/vote'
import { createSessionId, renewSession, verifySession } from './session-token'
import { castVote, getCounts, getRemaining, type VoteServiceDeps } from './vote-service'

export const SESSION_TOKEN_HEADER = 'x-session-token'

/** 集計数をキャッシュしてよい秒数（ブラウザと CloudFront） */
export const COUNTS_MAX_AGE_SECONDS = 5

/** リクエスト本文の上限 */
const MAX_BODY_BYTES = 1024

/** 票 ID：英数字・ハイフン・アンダースコア、64 文字まで */
const VOTE_ID_PATTERN = /^[\w-]{1,64}$/

export interface ApiDeps extends VoteServiceDeps {
  /** 署名用の鍵。必要になったときだけ取得する */
  signingKey: () => Promise<string>
}

type Response = APIGatewayProxyStructuredResultV2

function json(statusCode: number, body: unknown, cacheControl = 'no-store'): Response {
  return {
    statusCode,
    headers: { 'content-type': 'application/json', 'cache-control': cacheControl },
    body: JSON.stringify(body),
  }
}

function error(statusCode: number, code: string): Response {
  return json(statusCode, { error: code })
}

function isImpulseKey(value: unknown): value is ImpulseKey {
  return typeof value === 'string' && (IMPULSE_KEYS as readonly string[]).includes(value)
}

function parseVoteBody(event: APIGatewayProxyEventV2): { impulse: ImpulseKey, voteId: string } | null {
  if (!event.body) return null
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { impulse, voteId } = value as Record<string, unknown>
    if (!isImpulseKey(impulse) || typeof voteId !== 'string' || !VOTE_ID_PATTERN.test(voteId)) return null
    return { impulse, voteId }
  }
  catch {
    return null
  }
}

async function authenticate(event: APIGatewayProxyEventV2, deps: ApiDeps): Promise<{ sid: string, key: string } | null> {
  const key = await deps.signingKey()
  const claims = verifySession(event.headers[SESSION_TOKEN_HEADER], key, deps.now())
  return claims ? { sid: claims.sid, key } : null
}

async function route(event: APIGatewayProxyEventV2, deps: ApiDeps): Promise<Response> {
  switch (event.routeKey) {
    case 'GET /counts': {
      const counts = await getCounts(deps)
      return json(200, { counts }, `public, max-age=${COUNTS_MAX_AGE_SECONDS}`)
    }
    case 'POST /sessions': {
      const key = await deps.signingKey()
      const sid = createSessionId()
      // 新しいセッションには記録がないため、残り枠は読まずに上限いっぱいで返す
      const remaining = createImpulseRecord(() => VOTE_LIMIT)
      return json(201, { token: renewSession(sid, deps.now(), key), remaining })
    }
    case 'GET /sessions/me': {
      const session = await authenticate(event, deps)
      if (!session) return error(401, 'invalid_session')
      const remaining = await getRemaining(deps, session.sid)
      return json(200, { token: renewSession(session.sid, deps.now(), session.key), remaining })
    }
    case 'POST /votes': {
      const session = await authenticate(event, deps)
      if (!session) return error(401, 'invalid_session')
      const body = parseVoteBody(event)
      if (!body) return error(400, 'invalid_request')
      const result = await castVote(deps, session.sid, body.impulse, body.voteId)
      const token = renewSession(session.sid, deps.now(), session.key)
      if (result.status === 'limit') {
        return json(409, { error: 'limit', token, remaining: result.remaining })
      }
      return json(200, { result: result.status, token, remaining: result.remaining })
    }
    default:
      return error(404, 'not_found')
  }
}

export function createApiHandler(deps: ApiDeps) {
  return async (event: APIGatewayProxyEventV2): Promise<Response> => {
    try {
      return await route(event, deps)
    }
    catch (cause) {
      // トークンやリクエスト本文はログに残さない
      console.error('API の処理に失敗した', { routeKey: event.routeKey, error: cause instanceof Error ? cause.message : String(cause) })
      return error(500, 'internal_error')
    }
  }
}
