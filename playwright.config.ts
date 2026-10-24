import { defineConfig, devices } from '@playwright/test'

const PORT = 3100
// サブパスで配信する成果物（GitHub Pages 用）を確かめるときに指定する。例：/impulsive-momentum-indicator/
const BASE_PATH = process.env.E2E_BASE_PATH ?? '/'

// スマホ（390×844）と PC（1280×800）の2つのビューポートで、静的生成した成果物を確かめる
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
  },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: `node tests/e2e/static-server.mjs`,
    env: { PORT: String(PORT), BASE_PATH },
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
})
