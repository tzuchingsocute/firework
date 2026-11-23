import { defineConfig } from '@playwright/test'

const port = Number(process.env.STAGE1_PORT ?? 5187)

export default defineConfig({
  testDir: './tests',
  outputDir: 'test-results/artifacts',
  testMatch: '**/*.spec.js',
  workers: 1,
  timeout: 190000,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/browser.json' }]],
  use: {
    browserName: 'chromium',
    channel: process.env.STAGE1_CHROME_CHANNEL || 'chrome',
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 414, height: 896 },
    screenshot: 'only-on-failure',
    launchOptions: { args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      ...(process.env.STAGE1_VIDEO ? [`--use-file-for-fake-video-capture=${process.env.STAGE1_VIDEO}`] : []),
    ] },
  },
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${port} --strictPort${process.env.APP_PUBLIC === '1' ? ' --base=/firework/' : ''}`,
    url: `http://127.0.0.1:${port}`,
  },
})
