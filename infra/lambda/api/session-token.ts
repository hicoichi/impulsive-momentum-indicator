// 署名付きの匿名セッショントークン。ユーザー情報は持たず、ランダムなセッション ID と有効期限だけを含む

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/** 有効期限。使うたびにこの長さだけ延長する */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** 署名方式を変えたときに古いトークンを区別するための版 */
const TOKEN_VERSION = 1

/** 不正に長い入力を検証前に弾く */
const MAX_TOKEN_LENGTH = 512

/** セッション ID：16 バイトの乱数を base64url にしたもの */
const SESSION_ID_PATTERN = /^[\w-]{22}$/

export interface SessionClaims {
  sid: string
  /** 有効期限（エポックミリ秒） */
  exp: number
}

export function createSessionId(): string {
  return randomBytes(16).toString('base64url')
}

function sign(payload: string, key: string): Buffer {
  return createHmac('sha256', key).update(payload).digest()
}

export function signSession(claims: SessionClaims, key: string): string {
  const payload = Buffer.from(JSON.stringify({ v: TOKEN_VERSION, sid: claims.sid, exp: claims.exp })).toString('base64url')
  return `${payload}.${sign(payload, key).toString('base64url')}`
}

/** 期限を延長したトークンを発行する */
export function renewSession(sid: string, now: number, key: string): string {
  return signSession({ sid, exp: now + SESSION_TTL_MS }, key)
}

function parseClaims(payload: string): SessionClaims | null {
  try {
    const value: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (typeof value !== 'object' || value === null) return null
    const { v, sid, exp } = value as Record<string, unknown>
    if (v !== TOKEN_VERSION) return null
    if (typeof sid !== 'string' || !SESSION_ID_PATTERN.test(sid)) return null
    if (typeof exp !== 'number' || !Number.isFinite(exp)) return null
    return { sid, exp }
  }
  catch {
    return null
  }
}

/** 署名と有効期限を検証する。不正・期限切れなら null */
export function verifySession(token: unknown, key: string, now: number): SessionClaims | null {
  if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payload, signature] = parts
  if (!payload || !signature) return null
  const expected = sign(payload, key)
  const actual = Buffer.from(signature, 'base64url')
  // 比較にかかる時間から署名を推測されないよう、一定時間で比較する
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
  const claims = parseClaims(payload)
  if (!claims || claims.exp <= now) return null
  return claims
}
