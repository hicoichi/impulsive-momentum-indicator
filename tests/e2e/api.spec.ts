import { expect, test, type Page, type Route } from '@playwright/test'

// API 接続版のビルド（NUXT_PUBLIC_API_BASE_URL を指定したもの）のテスト。
// 本物の AWS には接続せず、ビルドに埋め込んだ URL へのリクエストをすべて横取りして応答する
const API_BASE_URL = (process.env.E2E_API_BASE_URL ?? '').replace(/\/+$/, '')
test.skip(!API_BASE_URL, 'E2E_API_BASE_URL を指定した API 接続版のビルドだけで確かめる')

type Key = 'ikki' | 'exodus' | 'festival'
type Counts = Record<Key, number>

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,x-session-token',
}

/** 投票を受け付けるかどうかを、テストごとに切り替えられる偽のバックエンド */
class FakeBackend {
  counts: Counts = { ikki: 1000, exodus: 3000, festival: 4000 }
  remaining: Counts = { ikki: 10, exodus: 10, festival: 10 }
  voteStatus: 200 | 409 | 429 = 200
  readonly requests: { method: string, path: string, token: string | null }[] = []

  async handle(route: Route) {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const token = request.headers()['x-session-token'] ?? null
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS })
      return
    }
    this.requests.push({ method: request.method(), path, token })
    const reply = (status: number, body: unknown) =>
      route.fulfill({ status, headers: { ...CORS_HEADERS, 'content-type': 'application/json' }, body: JSON.stringify(body) })

    if (request.method() === 'GET' && path === '/counts') return reply(200, { counts: this.counts })
    if (request.method() === 'POST' && path === '/sessions') return reply(201, { token: 'token-1', remaining: this.remaining })
    if (request.method() === 'GET' && path === '/sessions/me') return reply(200, { token: 'token-2', remaining: this.remaining })
    if (request.method() === 'POST' && path === '/votes') {
      if (this.voteStatus === 429) return reply(429, { message: 'Too Many Requests' })
      const { impulse } = request.postDataJSON() as { impulse: Key }
      if (this.voteStatus === 409) {
        this.remaining = { ...this.remaining, [impulse]: 0 }
        return reply(409, { error: 'limit', token: 'token-2', remaining: this.remaining })
      }
      this.counts = { ...this.counts, [impulse]: this.counts[impulse] + 1 }
      this.remaining = { ...this.remaining, [impulse]: this.remaining[impulse] - 1 }
      return reply(200, { result: 'accepted', token: 'token-2', remaining: this.remaining })
    }
    return reply(404, { error: 'not_found' })
  }
}

async function open(page: Page, backend: FakeBackend) {
  await page.route(`${API_BASE_URL}/**`, route => backend.handle(route))
  await page.goto('./')
}

function activeSlide(page: Page) {
  return page.locator('section.slide[aria-hidden="false"]')
}

/** エンブレムを押し、投票の応答を画面が受け取るまで待つ（押した瞬間の +1 は応答より先に表示される） */
async function voteAndWait(page: Page) {
  const response = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/votes')
  await activeSlide(page).locator('button.emblem').click()
  await response
}

test('模擬データのバッジを出さず、API の集計数を表示する', async ({ page }) => {
  const backend = new FakeBackend()
  await open(page, backend)
  await expect(page.getByTestId('simulation-badge')).toHaveCount(0)
  await expect(activeSlide(page).getByTestId('count')).toHaveText('1,000')
})

test('最初の投票でセッションを発行してから投票し、+1 と残り枠を反映する', async ({ page }) => {
  const backend = new FakeBackend()
  await open(page, backend)
  await expect(activeSlide(page).getByTestId('count')).toHaveText('1,000')
  await voteAndWait(page)
  await expect(activeSlide(page).getByTestId('count')).toHaveText('1,001')
  await expect(page.locator('.pip.on')).toHaveCount(9)
  const paths = backend.requests.map(r => `${r.method} ${r.path}`)
  expect(paths.indexOf('POST /sessions')).toBeLessThan(paths.indexOf('POST /votes'))
  expect(backend.requests.find(r => r.path === '/votes')?.token).toBe('token-1')
})

test('上限（409）なら上限の表示になる', async ({ page }) => {
  const backend = new FakeBackend()
  backend.voteStatus = 409
  await open(page, backend)
  await expect(activeSlide(page).getByTestId('count')).toHaveText('1,000')
  await activeSlide(page).locator('button.emblem').click()
  await expect(page.getByTestId('meter')).toHaveText('いまは、ここまで')
  await expect(activeSlide(page).getByTestId('count')).toHaveText('1,000')
})

test('流量上限（429）なら +1 を元に戻す', async ({ page }) => {
  const backend = new FakeBackend()
  backend.voteStatus = 429
  await open(page, backend)
  await expect(activeSlide(page).getByTestId('count')).toHaveText('1,000')
  await activeSlide(page).locator('button.emblem').click()
  await expect(activeSlide(page).getByTestId('count')).toHaveText('1,000')
  await expect(page.locator('.pip.on')).toHaveCount(10)
})

// 時計を止めずに動かすので、端をまたいだあとの差し替え（transitionend）が本物のブラウザで起きるかを確かめられる
test('C-09: 端から端へループしたあとも、表示中の衝動が画面内に見えていて投票できる', async ({ page }) => {
  const backend = new FakeBackend()
  await open(page, backend)
  await expect(activeSlide(page).getByTestId('count')).toHaveText('1,000')
  await page.locator('.root').focus()
  await page.keyboard.press('ArrowLeft')
  await expect(activeSlide(page).getByRole('heading')).toHaveText('祭りたい')
  // 移動が終わり、複製から本物のスライドへ差し替わるのを待つ
  await expect(activeSlide(page).locator('button.emblem')).toBeInViewport({ ratio: 0.9 })
  await voteAndWait(page)
  await expect(activeSlide(page).getByTestId('count')).toHaveText('4,001')
  await page.keyboard.press('ArrowRight')
  await expect(activeSlide(page).getByRole('heading')).toHaveText('一揆したい')
  await expect(activeSlide(page).locator('button.emblem')).toBeInViewport({ ratio: 0.9 })
})

test('開き直すと、保存したトークンで残り枠を取り直す', async ({ page }) => {
  const backend = new FakeBackend()
  await open(page, backend)
  await voteAndWait(page)
  await expect(page.locator('.pip.on')).toHaveCount(9)
  await page.reload()
  await expect(page.locator('.pip.on')).toHaveCount(9)
  // 開き直した画面は、保存しておいたトークンで残り枠を問い合わせる
  await expect.poll(() => backend.requests.some(r => r.path === '/sessions/me' && r.token !== null)).toBe(true)
})
