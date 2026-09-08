const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './test/browser',
    timeout: 120000,
    expect: { timeout: 10000 },
    fullyParallel: false,
    workers: 1,
    reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
    use: {
        baseURL: 'http://127.0.0.1:3100',
        headless: true,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure'
    },
    webServer: {
        command: 'npm run client:build && FRONTEND_MODE=react DB_NAME=central_govt_db_test MEDICINE_SCAN_PROVIDER=mock API_RATE_LIMIT_MAX=2000 PORT=3100 node src/app.js',
        url: 'http://127.0.0.1:3100/index.html',
        reuseExistingServer: false,
        timeout: 120000
    }
});
