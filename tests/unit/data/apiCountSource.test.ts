import { describe, expect, it, vi } from 'vitest'
import { COUNTS_POLL_INTERVAL_MS, createApiCountSource, SESSION_TOKEN_HEADER, type TokenStorage } from '../../../app/data/apiCountSource'
import { parseApiBaseUrl } from '../../../app/data/createCountSource'

const BASE = 'https://api.example.com'
const FULL = { ikki: 10, revolution: 10, exodus: 10, festival: 10 }

function memoryStorage(initial: string | null = null): TokenStorage & { value: string | null } {
  return {
    value: initial,
    get() { return this.value },
    set(token) { this.value = token },
    clear() { this.value = null },
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

type Handler = (url: string, init?: RequestInit) => Response

function fakeFetch(handler: Handler) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init))
}

/** 非同期の取得が終わるのを待つ */
async function flush() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

describe('parseApiBaseUrl', () => {
  it('https と localhost だけを受け付け、末尾の / を取り除く', () => {
    expect(parseApiBaseUrl('https://xxxx.cloudfront.net/')).toBe('https://xxxx.cloudfront.net')
    expect(parseApiBaseUrl('http://localhost:8787')).toBe('http://localhost:8787')
  })

  it('空・http・不正な値は null（モックで動く）', () => {
    for (const value of ['', '  ', undefined, 123, 'http://example.com', 'not a url']) {
      expect(parseApiBaseUrl(value)).toBeNull()
    }
  })
})

describe('createApiCountSource', () => {
  it('取得前は集計数が null', () => {
    const source = createApiCountSource({ baseUrl: BASE, fetch: fakeFetch(() => jsonResponse(200, {})), storage: memoryStorage() })
    expect(source.read(0).others).toBeNull()
  })

  it('10秒ごとに GET /counts で集計数を取得する', async () => {
    const fetch = fakeFetch(() => jsonResponse(200, { counts: { ikki: 5, revolution: 6, exodus: 7, festival: 8 } }))
    const source = createApiCountSource({ baseUrl: `${BASE}/`, fetch, storage: memoryStorage() })
    source.advance(0)
    await flush()
    expect(fetch).toHaveBeenCalledWith(`${BASE}/counts`)
    expect(source.read(0).others).toEqual({ ikki: 5, revolution: 6, exodus: 7, festival: 8 })
    source.advance(COUNTS_POLL_INTERVAL_MS - 1)
    expect(fetch).toHaveBeenCalledTimes(1)
    source.advance(COUNTS_POLL_INTERVAL_MS)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('取得に失敗しても前回の値を保つ', async () => {
    let fail = false
    const fetch = fakeFetch(() => {
      if (fail) throw new Error('network')
      return jsonResponse(200, { counts: { ikki: 5, revolution: 6, exodus: 7, festival: 8 } })
    })
    const source = createApiCountSource({ baseUrl: BASE, fetch, storage: memoryStorage() })
    source.advance(0)
    await flush()
    fail = true
    source.advance(COUNTS_POLL_INTERVAL_MS)
    await flush()
    expect(source.read(0).others?.ikki).toBe(5)
  })

  it('最初の投票でセッションを発行し、トークンを保存して投票する', async () => {
    const storage = memoryStorage()
    const fetch = fakeFetch((url, init) => {
      if (url.endsWith('/sessions')) return jsonResponse(201, { token: 't1', remaining: FULL })
      if (url.endsWith('/votes')) {
        expect((init?.headers as Record<string, string>)[SESSION_TOKEN_HEADER]).toBe('t1')
        expect(JSON.parse(String(init?.body))).toEqual({ impulse: 'ikki', voteId: 'v1' })
        return jsonResponse(200, { result: 'accepted', token: 't2', remaining: { ...FULL, ikki: 9 } })
      }
      throw new Error(url)
    })
    const source = createApiCountSource({ baseUrl: BASE, fetch, storage })
    expect(await source.submitVote('ikki', 'v1')).toEqual({ ok: true, duplicate: false })
    expect(storage.value).toBe('t2')
    expect(source.read(0).mine.ikki).toBe(1)
  })

  it('自分の票が確定すると、次の取得までの間も +1 が残る', async () => {
    const fetch = fakeFetch((url) => {
      if (url.endsWith('/counts')) return jsonResponse(200, { counts: { ikki: 100, revolution: 0, exodus: 0, festival: 0 } })
      return jsonResponse(200, { result: 'accepted', token: 't', remaining: { ...FULL, ikki: 9 } })
    })
    const source = createApiCountSource({ baseUrl: BASE, fetch, storage: memoryStorage('t') })
    source.advance(0)
    await flush()
    await source.submitVote('ikki', 'v1')
    const { others, mine } = source.read(0)
    expect((others?.ikki ?? 0) + mine.ikki).toBe(101)
  })

  it('上限（409）で自分の票数が判明しても、表示の合計は変えない', async () => {
    const fetch = fakeFetch((url) => {
      if (url.endsWith('/counts')) return jsonResponse(200, { counts: { ikki: 100, revolution: 0, exodus: 0, festival: 0 } })
      return jsonResponse(409, { error: 'limit', token: 't', remaining: { ...FULL, ikki: 0 } })
    })
    const source = createApiCountSource({ baseUrl: BASE, fetch, storage: memoryStorage('t') })
    source.advance(0)
    await flush()
    await source.submitVote('ikki', 'v1')
    const { others, mine } = source.read(0)
    expect(mine.ikki).toBe(10)
    expect((others?.ikki ?? 0) + mine.ikki).toBe(100)
  })

  it('上限（409）は limit として返し、残り枠を反映する', async () => {
    const fetch = fakeFetch(() => jsonResponse(409, { error: 'limit', token: 't', remaining: { ...FULL, ikki: 0 } }))
    const source = createApiCountSource({ baseUrl: BASE, fetch, storage: memoryStorage('t') })
    expect(await source.submitVote('ikki', 'v1')).toEqual({ ok: false, reason: 'limit' })
    expect(source.read(0).mine.ikki).toBe(10)
  })

  it('トークンが無効（401）なら取り直して1回だけ送り直す', async () => {
    const storage = memoryStorage('old')
    const fetch = fakeFetch((url, init) => {
      if (url.endsWith('/sessions')) return jsonResponse(201, { token: 'new', remaining: FULL })
      const token = (init?.headers as Record<string, string>)[SESSION_TOKEN_HEADER]
      return token === 'old'
        ? jsonResponse(401, { error: 'invalid_session' })
        : jsonResponse(200, { result: 'accepted', token: 'new2', remaining: { ...FULL, ikki: 9 } })
    })
    const source = createApiCountSource({ baseUrl: BASE, fetch, storage })
    expect(await source.submitVote('ikki', 'v1')).toEqual({ ok: true, duplicate: false })
    expect(storage.value).toBe('new2')
  })

  it('流量上限（429）などの失敗は例外にする', async () => {
    const fetch = fakeFetch(() => jsonResponse(429, { message: 'Too Many Requests' }))
    const source = createApiCountSource({ baseUrl: BASE, fetch, storage: memoryStorage('t') })
    await expect(source.submitVote('ikki', 'v1')).rejects.toThrow('HTTP 429')
  })

  it('保存済みのトークンがあれば残り枠を取り直す', async () => {
    const fetch = fakeFetch((url) => {
      if (url.endsWith('/sessions/me')) return jsonResponse(200, { token: 't2', remaining: { ...FULL, festival: 4 } })
      return jsonResponse(200, { counts: { ikki: 0, revolution: 0, exodus: 0, festival: 0 } })
    })
    const storage = memoryStorage('t1')
    const source = createApiCountSource({ baseUrl: BASE, fetch, storage })
    source.advance(0)
    await flush()
    expect(source.read(0).mine.festival).toBe(6)
    expect(storage.value).toBe('t2')
  })
})
