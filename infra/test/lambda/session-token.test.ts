import { createSessionId, renewSession, SESSION_TTL_MS, signSession, verifySession } from '../../lambda/api/session-token'

const KEY = 'k'.repeat(32)
const NOW = 1_800_000_000_000

describe('セッショントークン', () => {
  test('発行したトークンを検証でき、有効期限は30日', () => {
    const sid = createSessionId()
    const token = renewSession(sid, NOW, KEY)
    expect(verifySession(token, KEY, NOW)).toEqual({ sid, exp: NOW + SESSION_TTL_MS })
    expect(SESSION_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000)
  })

  test('セッション ID は毎回異なる', () => {
    expect(createSessionId()).not.toBe(createSessionId())
  })

  test('期限切れは無効', () => {
    const token = signSession({ sid: createSessionId(), exp: NOW }, KEY)
    expect(verifySession(token, KEY, NOW)).toBeNull()
    expect(verifySession(token, KEY, NOW - 1)).not.toBeNull()
  })

  test('別の鍵で署名したものは無効', () => {
    const token = renewSession(createSessionId(), NOW, 'x'.repeat(32))
    expect(verifySession(token, KEY, NOW)).toBeNull()
  })

  test('中身を書き換えたものは無効', () => {
    const token = renewSession(createSessionId(), NOW, KEY)
    const [, signature] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ v: 1, sid: createSessionId(), exp: NOW + SESSION_TTL_MS })).toString('base64url')
    expect(verifySession(`${forged}.${signature}`, KEY, NOW)).toBeNull()
  })

  test('形式が不正なものは無効', () => {
    for (const token of [undefined, 123, '', 'abc', 'a.b.c', '.', `${'a'.repeat(600)}.b`]) {
      expect(verifySession(token, KEY, NOW)).toBeNull()
    }
  })

  test('署名が正しくても、セッション ID の形式が不正なら無効', () => {
    const token = signSession({ sid: '../../etc', exp: NOW + 1000 }, KEY)
    expect(verifySession(token, KEY, NOW)).toBeNull()
  })
})
