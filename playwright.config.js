const { defineConfig } = require('@playwright/test');
const testPort = Number(process.env.TEST_PORT || 3100);

module.exports = defineConfig({
    testDir: './test/browser',
    timeout: 120000,
    expect: { timeout: 10000 },
    fullyParallel: false,
    workers: 1,
    reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
    use: {
        baseURL: `http://127.0.0.1:${testPort}`,
        headless: true,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
        ...(process.env.ASSISTANT_LIVE_SMOKE === '1' && process.env.SYNTHETIC_AUDIO_PATH ? {
            permissions: ['microphone'],
            launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${process.env.SYNTHETIC_AUDIO_PATH}`] }
        } : {})
    },
    webServer: {
        command: `npm run client:build && FRONTEND_MODE=react DB_NAME=central_govt_db_test MEDICINE_SCAN_PROVIDER=mock API_RATE_LIMIT_MAX=2000 PORT=${testPort} node src/app.js`,
        url: `http://127.0.0.1:${testPort}/index.html`,
        reuseExistingServer: false,
        timeout: 120000
    }
});
