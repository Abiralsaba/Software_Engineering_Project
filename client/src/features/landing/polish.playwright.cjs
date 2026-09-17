const { defineConfig } = require('@playwright/test');
const path = require('node:path');
const os = require('node:os');

// With the frontend running: npx playwright test --config=client/src/features/landing/polish.playwright.cjs
module.exports = defineConfig({
  testDir: __dirname,
  testMatch: 'polish.browser.cjs',
  timeout: 60000,
  workers: 1,
  reporter: 'list',
  outputDir: path.join(os.tmpdir(), 'nationx-landing-polish-results'),
  use: {
    baseURL: process.env.NATIONX_LANDING_URL || 'http://127.0.0.1:5173',
    headless: true,
    trace: 'retain-on-failure',
    video: { mode: 'on', size: { width: 1440, height: 900 } }
  }
});
