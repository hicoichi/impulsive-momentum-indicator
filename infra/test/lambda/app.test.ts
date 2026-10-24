import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda'
import { createApiHandler, SESSION_TOKEN_HEADER, type ApiDeps } from '../../lambda/api/app'
import { renewSession, verifySession } from '../../lambda/api/session-token'
import { MemoryVoteStore } from './memory-vote-store'

const KEY = 'k'.repeat(32)
const NOW = 1_800_000_000_000
const SID = 'AAAAAAAAAAAAAAAAAAAAAA'

function setup() {
  const store = new MemoryVoteStore()
  const deps: ApiDeps = { store, now: () => NOW, windowMs: 12 * 60 * 60 * 1000, signingKey: async () => KEY }
  return { store, handler: createApiHandler(deps) }
}

function event(routeKey: string, options: { token?: string, body?: unknown } = {}): APIGatewayProxyEventV2 {
  return {
    routeKey,
    headers: options.token ? { [SESSION_TOKEN_HEADER]: options.token } : {},
    body: options.body === undefined ? undefined : typeof options.body === 'string' ? options.body : JSON.stringify(options.body),
    isBase64Encoded: false,
  } as unknown as APIGatewayProxyEventV2
}

function parse(response: APIGatewayProxyStructuredResultV2): Record<string, unknown> {
  return JSON.parse(response.body ?? '{}') as Record<string, unknown>
}

const token = renewSession(SID, NOW, KEY)

describe('GET /counts', () => {
  test('集計数を返し、5秒だけキャッシュさせる', async () => {
    const { handler } = setup()
    await handler(event('POST /votes', { token, body: { impulse: 'festival', voteId: 'v1' } }))
    const response = await handler(event('GET /counts'))
    expect(response.statusCode).toBe(200)
    expect(response.headers?.['cache-control']).toBe('public, max-age=5')
    expect(parse(response)).toEqual({ counts: { ikki: 0, exodus: 0, festival: 1 } })
  })
})

describe('POST /sessions', () => {
  test('有効なトークンと上限いっぱいの残り枠を返し、キャッシュさせない', async () => {
    const { handler } = setup()
    const response = await handler(event('POST /sessions'))
    expect(response.statusCode).toBe(201)
    expect(response.headers?.['cache-control']).toBe('no-store')
    const body = parse(response)
    expect(verifySession(body.token, KEY, NOW)).not.toBeNull()
    expect(body.remaining).toEqual({ ikki: 10, exodus: 10, festival: 10 })
  })
})

describe('GET /sessions/me', () => {
  test('トークンがなければ 401', async () => {
    const { handler } = setup()
    expect((await handler(event('GET /sessions/me'))).statusCode).toBe(401)
    expect((await handler(event('GET /sessions/me', { token: 'forged.token' }))).statusCode).toBe(401)
  })

  test('残り枠と延長したトークンを返し、キャッシュさせない', async () => {
    const { handler } = setup()
    await handler(event('POST /votes', { token, body: { impulse: 'ikki', voteId: 'v1' } }))
    const response = await handler(event('GET /sessions/me', { token }))
    expect(response.statusCode).toBe(200)
    expect(response.headers?.['cache-control']).toBe('no-store')
    const body = parse(response)
    expect((body.remaining as Record<string, number>).ikki).toBe(9)
    expect(verifySession(body.token, KEY, NOW)?.sid).toBe(SID)
  })
})

describe('POST /votes', () => {
  test('受け付けると 200 と残り枠を返す', async () => {
    const { handler } = setup()
    const response = await handler(event('POST /votes', { token, body: { impulse: 'ikki', voteId: 'v1' } }))
    expect(response.statusCode).toBe(200)
    expect(parse(response)).toMatchObject({ result: 'accepted', remaining: { ikki: 9 } })
  })

  test('再送は duplicate', async () => {
    const { handler } = setup()
    await handler(event('POST /votes', { token, body: { impulse: 'ikki', voteId: 'v1' } }))
    const response = await handler(event('POST /votes', { token, body: { impulse: 'ikki', voteId: 'v1' } }))
    expect(parse(response)).toMatchObject({ result: 'duplicate', remaining: { ikki: 9 } })
  })

  test('上限に達すると 409', async () => {
    const { handler } = setup()
    for (let i = 0; i < 10; i++) await handler(event('POST /votes', { token, body: { impulse: 'ikki', voteId: `v${i}` } }))
    const response = await handler(event('POST /votes', { token, body: { impulse: 'ikki', voteId: 'v10' } }))
    expect(response.statusCode).toBe(409)
    expect(parse(response)).toMatchObject({ error: 'limit', remaining: { ikki: 0 } })
  })

  test('トークンが不正なら 401', async () => {
    const { handler } = setup()
    const response = await handler(event('POST /votes', { token: renewSession(SID, NOW, 'x'.repeat(32)), body: { impulse: 'ikki', voteId: 'v1' } }))
    expect(response.statusCode).toBe(401)
  })

  test.each([
    ['本文なし', undefined],
    ['JSON でない', 'not json'],
    ['存在しない衝動', { impulse: 'riot', voteId: 'v1' }],
    ['削除した衝動（革命したい）', { impulse: 'revolution', voteId: 'v1' }],
    ['票 ID が不正', { impulse: 'ikki', voteId: 'a b' }],
    ['票 ID が長すぎる', { impulse: 'ikki', voteId: 'a'.repeat(65) }],
    ['本文が大きすぎる', { impulse: 'ikki', voteId: 'v1', pad: 'x'.repeat(2000) }],
  ])('入力が不正なら 400（%s）', async (_, body) => {
    const { handler, store } = setup()
    const response = await handler(event('POST /votes', { token, body }))
    expect(response.statusCode).toBe(400)
    expect(store.buckets.size).toBe(0)
  })
})

describe('その他', () => {
  test('存在しないルートは 404', async () => {
    const { handler } = setup()
    expect((await handler(event('DELETE /votes'))).statusCode).toBe(404)
  })

  test('内部エラーは 500 で、詳細やトークンを応答に含めない', async () => {
    const { handler, store } = setup()
    store.sumCounts = async () => {
      throw new Error('secret detail')
    }
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const response = await handler(event('GET /counts'))
    expect(response.statusCode).toBe(500)
    expect(response.body).not.toContain('secret detail')
    expect(JSON.stringify(spy.mock.calls)).not.toContain(token)
    spy.mockRestore()
  })
})
