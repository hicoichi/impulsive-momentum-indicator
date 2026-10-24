import { defineConfig, devices } from '@playwright/test'

const PORT = 3100

// スマホ（390×844）と PC（1280×800）の2つのビューポートで、静的生成した成果物を確かめる
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
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
    env: { PORT: String(PORT) },
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
})
