import { expect, test, type Page } from '@playwright/test'

// 模擬変動（1秒ごと）と投票の確定（140ms）を手で進めるため、時計を止めて始める
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-24T09:00:00+09:00') })
  await page.clock.pauseAt(new Date('2026-10-24T09:00:01+09:00'))
  await page.goto('/')
})

function activeSlide(page: Page) {
  return page.locator('section.slide[aria-hidden="false"]')
}

async function vote(page: Page) {
  await activeSlide(page).locator('button.emblem').click()
  await page.clock.runFor(140)
}

test('US-A1・US-A3: 1つの衝動、模擬データのバッジ、コンセプト文を表示する', async ({ page }) => {
  await expect(page.getByTestId('simulation-badge')).toBeVisible()
  await expect(page.getByText('世界の空気を、衝動で測る。')).toBeVisible()
  await expect(page.locator('section.slide[aria-hidden="false"]')).toHaveCount(1)
  await expect(activeSlide(page).getByRole('heading')).toHaveText('一揆したい')
  await expect(activeSlide(page).getByTestId('count')).toHaveText('123,456')
})

test('US-A1・NFR-01: 主要な要素がスクロールなしで画面内に収まり、横スクロールが出ない', async ({ page }) => {
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('ビューポートが取れない')
  for (const locator of [
    activeSlide(page).locator('button.emblem'),
    activeSlide(page).getByTestId('count'),
    page.getByTestId('meter'),
    page.locator('.dots'),
  ]) {
    const box = await locator.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height)
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflow).toBe(false)
})

test('US-C1・US-D1・US-D2: エンブレムを押すと +1 され、残り枠が減る', async ({ page }) => {
  const url = page.url()
  await vote(page)
  await expect(activeSlide(page).getByTestId('count')).toHaveText('123,457')
  await expect(page.locator('.pip.on')).toHaveCount(9)
  await expect(page.getByTestId('meter')).not.toContainText('絵を押して、1票')
  expect(page.url()).toBe(url)
})

test('US-E1・US-E2: 10票で上限の表示になり、11票目は数えない', async ({ page }) => {
  for (let i = 0; i < 10; i++) await vote(page)
  await expect(activeSlide(page).getByTestId('count')).toHaveText('123,466')
  await expect(page.getByTestId('meter')).toHaveText('いまは、ここまで')
  await expect(activeSlide(page).locator('button.emblem')).toHaveAttribute('aria-disabled', 'true')
  await vote(page)
  await expect(activeSlide(page).getByTestId('count')).toHaveText('123,466')
})

test('US-D3: 時間が進むと他ユーザー分が模擬変動する', async ({ page }) => {
  const count = activeSlide(page).getByTestId('count')
  const before = await count.textContent()
  // 1秒ごとの変動は小さく揺れ戻ることもあるため、十分な回数進める
  await page.clock.runFor(30_000)
  await expect(count).not.toHaveText(before ?? '')
})

test('US-B3・US-B6: インジケーターで移動できる', async ({ page }) => {
  await page.getByRole('button', { name: '祭りたい' }).click()
  await expect(activeSlide(page).getByRole('heading')).toHaveText('祭りたい')
})

test.describe('スマホ', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) > 700, 'スマホのビューポートだけで確認する')

  test('US-B2: 矢印ボタンは表示しない', async ({ page }) => {
    await expect(page.getByRole('button', { name: '次の衝動' })).toBeHidden()
  })

  test('US-B1: 横スワイプで切り替わり、短いスワイプでは戻る', async ({ page }) => {
    const url = page.url()
    const stage = page.locator('.stage')
    const box = await stage.boundingBox()
    if (!box) throw new Error('ステージが取れない')
    const y = box.y + box.height * 0.8
    const swipe = async (fromX: number, toX: number) => {
      await page.mouse.move(fromX, y)
      await page.mouse.down()
      await page.mouse.move((fromX + toX) / 2, y, { steps: 5 })
      await page.mouse.move(toX, y, { steps: 5 })
      await page.mouse.up()
      await page.clock.runFor(600)
    }
    // 閾値（min(80px, 幅 × 18%) ≒ 70px）未満なら戻る
    await swipe(box.x + 250, box.x + 200)
    await expect(activeSlide(page).getByRole('heading')).toHaveText('一揆したい')
    // 左へ大きくスワイプすると次へ
    await swipe(box.x + 300, box.x + 100)
    await expect(activeSlide(page).getByRole('heading')).toHaveText('革命したい')
    // 右へスワイプすると前へ
    await swipe(box.x + 100, box.x + 300)
    await expect(activeSlide(page).getByRole('heading')).toHaveText('一揆したい')
    // 先頭でさらに右へスワイプしても切り替わらない
    await swipe(box.x + 100, box.x + 300)
    await expect(activeSlide(page).getByRole('heading')).toHaveText('一揆したい')
    expect(page.url()).toBe(url)
  })

  test('US-B1: スワイプ直後のタップでは投票されない', async ({ page }) => {
    const emblem = activeSlide(page).locator('button.emblem')
    const box = await emblem.boundingBox()
    if (!box) throw new Error('エンブレムが取れない')
    const y = box.y + box.height / 2
    await page.mouse.move(box.x + box.width / 2, y)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 - 30, y, { steps: 5 })
    await page.mouse.up()
    await page.clock.runFor(140)
    await expect(activeSlide(page).getByTestId('count')).toHaveText('123,456')
  })
})

test.describe('PC', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) <= 700, 'PC のビューポートだけで確認する')

  test('US-B2: 矢印ボタンで切り替わり、端では無効になる', async ({ page }) => {
    const prev = page.getByRole('button', { name: '前の衝動' })
    const next = page.getByRole('button', { name: '次の衝動' })
    await expect(prev).toBeDisabled()
    for (let i = 0; i < 3; i++) await next.click()
    await expect(activeSlide(page).getByRole('heading')).toHaveText('祭りたい')
    await expect(next).toBeDisabled()
  })

  test('US-B5: キーボードの ← → で切り替わる', async ({ page }) => {
    await page.locator('.root').focus()
    await page.keyboard.press('ArrowRight')
    await expect(activeSlide(page).getByRole('heading')).toHaveText('革命したい')
    await page.keyboard.press('ArrowLeft')
    await expect(activeSlide(page).getByRole('heading')).toHaveText('一揆したい')
  })

  test('US-C1: キーボードの Enter でも投票できる', async ({ page }) => {
    await activeSlide(page).locator('button.emblem').focus()
    await page.keyboard.press('Enter')
    await page.clock.runFor(140)
    await expect(activeSlide(page).getByTestId('count')).toHaveText('123,457')
  })
})
