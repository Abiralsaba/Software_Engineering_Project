const { test, expect } = require('@playwright/test');

const syntheticPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
);

async function login(page, email, password) {
    await page.goto('/index.html#signin');
    await page.locator('#citizen-email').fill(email);
    await page.locator('#citizen-password').fill(password);
    await page.getByRole('button', { name: /Login to Portal/ }).click();
    const confirm = page.locator('.swal2-confirm');
    await expect(confirm).toBeVisible();
    await confirm.click();
    await expect(page).toHaveURL(/dashboard\.html/);
}

test('synthetic Medicine Identifier scan, confirmation, alternatives, owner isolation and deletion', async ({ page, request }) => {
    await login(page, 'alice.demo@nationx.test', 'NationX-Demo-2026!');
    await page.goto('/health.html?section=medicine-identifier');
    await expect(page.getByRole('heading', { name: 'Medicine Identifier' })).toBeVisible();
    await page.getByLabel('Choose medicine images').setInputFiles({ name: 'synthetic-prescription.png', mimeType: 'image/png', buffer: syntheticPng });
    await expect(page.getByAltText('Selected medicine image 1')).toBeVisible();
    await page.getByRole('checkbox').check();
    const [scanResponse] = await Promise.all([
        page.waitForResponse(response => response.url().endsWith('/api/medicine-scans') && response.request().method() === 'POST'),
        page.getByRole('button', { name: 'Analyze visible text' }).click()
    ]);
    expect(scanResponse.status()).toBe(201);
    const scan = await scanResponse.json();
    await expect(page.getByText('A-Pak 100 mg tablet — 1 tablet twice daily for 5 days')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Confirm selected medicine' })).toBeDisabled();
    await page.getByRole('radio', { name: /A-Pak/ }).first().check();
    await page.getByRole('button', { name: 'Confirm selected medicine' }).click();
    await expect(page.getByRole('heading', { name: 'Confirmed by you' })).toBeVisible();
    await page.getByRole('button', { name: 'View possible lower-cost products' }).click();
    await expect(page.getByRole('heading', { name: 'Possible lower-cost products with the same recorded specifications' })).toBeVisible();
    await expect(page.getByText('Estimated saving:').first()).toBeVisible();
    await expect(page.getByText('Professional confirmation is required').first()).toBeVisible();

    const bobLogin = await request.post('/api/auth/login', { data: { email: 'bob.demo@nationx.test', password: 'NationX-Demo-2026!' } });
    expect(bobLogin.status()).toBe(200);
    const bobToken = (await bobLogin.json()).token;
    const foreignRead = await request.get(`/api/medicine-scans/${scan.scan_id}`, { headers: { Authorization: `Bearer ${bobToken}` } });
    expect(foreignRead.status()).toBe(403);

    await page.getByRole('button', { name: 'Delete scan' }).click();
    await expect(page.getByRole('button', { name: 'Delete scan' })).toHaveCount(0);
    const ownerAfterDelete = await request.get(`/api/medicine-scans/${scan.scan_id}`, { headers: { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('token'))}` } });
    expect(ownerAfterDelete.status()).toBe(404);
});
