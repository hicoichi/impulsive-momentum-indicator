// AWS のバックエンド（infra/）に接続する ImpulseCountSource（フェーズ2）
//
// - 集計数は 10 秒ごとに GET /counts で取得する（CloudFront で数秒キャッシュされる）
// - セッションは署名付きの匿名トークンで、localStorage に保存する。最初の投票のときに発行する
// - 上限の判定はサーバーが行い、ここでは結果を反映するだけ

import { createImpulseRecord, IMPULSE_KEYS, type ImpulseKey } from '../domain/impulse'
import { VOTE_LIMIT } from '../domain/vote'
import type { CountSnapshot, ImpulseCountSource, VoteResult } from './countSource'

/** 集計数を取得する間隔 */
export const COUNTS_POLL_INTERVAL_MS = 10_000

/** 自分の残り枠を取り直す間隔。開いたままの間に自分の票が12時間で外れるのを反映する */
export const SESSION_REFRESH_INTERVAL_MS = 5 * 60 * 1000

export const SESSION_TOKEN_HEADER = 'x-session-token'

const TOKEN_STORAGE_KEY = 'impulsive-momentum-indicator:session-token'

export interface TokenStorage {
  get(): string | null
  set(token: string): void
  clear(): void
}

/** localStorage が使えない環境（プライベートモードなど）では、メモリ上だけで持つ */
export function createBrowserTokenStorage(): TokenStorage {
  let memory: string | null = null
  return {
    get() {
      try {
        return globalThis.localStorage?.getItem(TOKEN_STORAGE_KEY) ?? memory
      }
      catch {
        return memory
      }
    },
    set(token) {
      memory = token
      try {
        globalThis.localStorage?.setItem(TOKEN_STORAGE_KEY, token)
      }
      catch {
        // 保存できなくても、メモリ上のトークンで続けられる
      }
    },
    clear() {
      memory = null
      try {
        globalThis.localStorage?.removeItem(TOKEN_STORAGE_KEY)
      }
      catch {
        // 消せなくても、次に 401 が返れば取り直す
      }
    },
  }
}

export interface ApiCountSourceOptions {
  /** CloudFront の URL（例：https://xxxx.cloudfront.net） */
  baseUrl: string
  fetch?: typeof fetch
  storage?: TokenStorage
}

type Counts = Record<ImpulseKey, number>

function toCounts(value: unknown): Counts | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  if (!IMPULSE_KEYS.every(key => typeof record[key] === 'number' && Number.isFinite(record[key]))) return null
  return createImpulseRecord(key => Math.max(0, record[key] as number))
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await response.json()
    return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
  }
  catch {
    return {}
  }
}

export function createApiCountSource(options: ApiCountSourceOptions): ImpulseCountSource {
  const baseUrl = options.baseUrl.replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis)
  const storage = options.storage ?? createBrowserTokenStorage()

  // 他ユーザー分は「取得した集計数 − その時点の自分の票数」として持つ。
  // 自分の票が確定したら mine だけが増え、次の取得までの間も +1 が表示に残る
  let others: Counts | null = null
  let mine: Counts = createImpulseRecord(() => 0)
  let lastCountsFetch = Number.NEGATIVE_INFINITY
  let lastSessionFetch = Number.NEGATIVE_INFINITY
  let fetchingCounts = false
  let fetchingSession = false

  /**
   * サーバーが返した残り枠を反映する。
   * 新しく受け付けた1票（acceptedKey）は集計数を +1 する。それ以外の変化（取り直し・上限の判明など）は
   * 取得済みの集計数にすでに含まれている票なので、他ユーザー分から差し引いて表示の合計を変えない
   */
  function applyRemaining(value: unknown, acceptedKey?: ImpulseKey): void {
    const remaining = toCounts(value)
    if (!remaining) return
    const next = createImpulseRecord(key => Math.max(0, VOTE_LIMIT - remaining[key]))
    const current = others
    if (current) {
      others = createImpulseRecord((key) => {
        const reconciled = next[key] - mine[key] - (key === acceptedKey ? 1 : 0)
        return Math.max(0, current[key] - reconciled)
      })
    }
    mine = next
  }

  function applyToken(value: unknown): void {
    if (typeof value === 'string' && value) storage.set(value)
  }

  async function fetchCounts(): Promise<void> {
    fetchingCounts = true
    try {
      const response = await doFetch(`${baseUrl}/counts`)
      if (!response.ok) return
      const counts = toCounts((await readJson(response)).counts)
      if (counts) others = createImpulseRecord(key => Math.max(0, counts[key] - mine[key]))
    }
    catch {
      // 一時的な失敗は、前回の値を表示したまま次の取得を待つ
    }
    finally {
      fetchingCounts = false
    }
  }

  async function fetchSession(token: string): Promise<void> {
    fetchingSession = true
    try {
      const response = await doFetch(`${baseUrl}/sessions/me`, { headers: { [SESSION_TOKEN_HEADER]: token } })
      if (response.status === 401) {
        storage.clear()
        mine = createImpulseRecord(() => 0)
        return
      }
      if (!response.ok) return
      const body = await readJson(response)
      applyToken(body.token)
      applyRemaining(body.remaining)
    }
    catch {
      // 次の取り直しを待つ
    }
    finally {
      fetchingSession = false
    }
  }

  async function createSession(): Promise<string> {
    const response = await doFetch(`${baseUrl}/sessions`, { method: 'POST' })
    if (!response.ok) throw new Error(`セッションを発行できなかった（HTTP ${response.status}）`)
    const body = await readJson(response)
    if (typeof body.token !== 'string' || !body.token) throw new Error('セッションの応答が不正')
    storage.set(body.token)
    applyRemaining(body.remaining)
    return body.token
  }

  async function postVote(token: string, key: ImpulseKey, voteId: string): Promise<Response> {
    return doFetch(`${baseUrl}/votes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [SESSION_TOKEN_HEADER]: token },
      body: JSON.stringify({ impulse: key, voteId }),
    })
  }

  return {
    read(): CountSnapshot {
      return { others: others ? { ...others } : null, mine: { ...mine } }
    },

    advance(now: number): void {
      if (!fetchingCounts && now - lastCountsFetch >= COUNTS_POLL_INTERVAL_MS) {
        lastCountsFetch = now
        void fetchCounts()
      }
      const token = storage.get()
      if (token && !fetchingSession && now - lastSessionFetch >= SESSION_REFRESH_INTERVAL_MS) {
        lastSessionFetch = now
        void fetchSession(token)
      }
    },

    async submitVote(key: ImpulseKey, voteId: string): Promise<VoteResult> {
      let token = storage.get() ?? await createSession()
      let response = await postVote(token, key, voteId)
      if (response.status === 401) {
        // 期限切れ・鍵の入れ替えなどで無効になったトークンは取り直して1回だけ送り直す
        storage.clear()
        token = await createSession()
        response = await postVote(token, key, voteId)
      }
      const body = await readJson(response)
      if (response.status === 409) {
        applyToken(body.token)
        applyRemaining(body.remaining)
        return { ok: false, reason: 'limit' }
      }
      if (!response.ok) throw new Error(`投票できなかった（HTTP ${response.status}）`)
      applyToken(body.token)
      const duplicate = body.result === 'duplicate'
      applyRemaining(body.remaining, duplicate ? undefined : key)
      return { ok: true, duplicate }
    },
  }
}
