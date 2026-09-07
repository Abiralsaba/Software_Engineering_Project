const { test, expect } = require('@playwright/test');

const citizenRoutes = [
    '/dashboard.html', '/profile.html', '/documents.html', '/history.html', '/events.html',
    '/contact.html', '/market.html', '/todo.html', '/community.html', '/shop.html', '/nid.html',
    '/passport.html', '/tax.html', '/health.html', '/water.html', '/land.html',
    '/agriculture.html', '/education.html'
];
const adminRoutes = ['/reports.html', '/admin-nid.html', '/admin-passport.html', '/admin-health.html', '/admin-water.html'];
const publicRoutes = ['/', '/index.html', '/register.html', '/forgot-password.html', '/admin-login.html', '/admission.html', '/apply.html?id=999999999'];
const allPresentationRoutes = [...new Set([...publicRoutes, ...citizenRoutes, ...adminRoutes])];

async function confirmAlert(page) {
    const confirm = page.locator('.swal2-confirm');
    if (await confirm.isVisible().catch(() => false)) await confirm.click();
}

async function assertReactDocument(page, route) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), `${route} navigation status`).toBe(200);
    await expect(page.locator('#root')).toBeVisible();
    await expect(page.locator('#root')).toContainText(/\S/);
    await expect(page.locator('script[type="module"][src^="/assets/"]')).toHaveCount(1);
    const refreshed = await page.reload({ waitUntil: 'domcontentloaded' });
    expect(refreshed?.status(), `${route} refresh status`).toBe(200);
    await expect(page.locator('#root')).toBeVisible();
    await expect(page.locator('#root')).toContainText(/\S/);
}

test.describe.serial('NationX teacher demonstration in Chromium', () => {
    test('all public presentation URLs navigate and refresh through React', async ({ page }) => {
        for (const route of publicRoutes) await assertReactDocument(page, route);
        for (const route of allPresentationRoutes) {
            const response = await page.request.get(route);
            expect(response.status(), `${route} Express cutover status`).toBe(200);
            expect(await response.text(), `${route} must serve the built React shell`).toContain('<div id="root"></div>');
        }
    });

    test('citizen authentication, complete URL cutover, Todo write lifecycle, payment label, and admin denial', async ({ page }) => {
        const serverFailures = [];
        const pageErrors = [];
        page.on('pageerror', error => pageErrors.push(error.message));
        page.on('response', response => { if (response.url().includes('/api/') && (response.status() >= 500 || response.status() === 429)) serverFailures.push(`${response.status()} ${response.url()}`); });
        await page.goto('/index.html#signin');
        await page.locator('#citizen-email').fill('alice.demo@nationx.test');
        await page.locator('#citizen-password').fill('NationX-Demo-2026!');
        await page.getByRole('button', { name: /Login to Portal/ }).click();
        await expect(page.locator('.swal2-confirm')).toBeVisible(); await confirmAlert(page);
        await expect(page).toHaveURL(/dashboard\.html/);
        const citizenToken = await page.evaluate(() => localStorage.getItem('token'));
        expect(citizenToken).toBeTruthy();

        for (const route of citizenRoutes) await assertReactDocument(page, route);

        const taskTitle = `BROWSER DEMO ${Date.now()}`;
        await page.goto('/todo.html');
        await page.getByRole('button', { name: /Add Item/ }).click();
        await page.getByLabel('Task Title').fill(taskTitle);
        await page.getByLabel('Description').fill('Synthetic browser demonstration task');
        await page.getByRole('button', { name: 'Create Task' }).click();
        await expect(page.getByRole('button', { name: new RegExp(taskTitle) })).toBeVisible();
        await page.getByRole('button', { name: new RegExp(taskTitle) }).click();
        await page.getByLabel('Task status').selectOption('done');
        await page.getByRole('button', { name: /Delete/ }).click();
        await expect(page.getByText(taskTitle)).toHaveCount(0);

        await page.goto('/passport.html?section=payment&status=success&tid=BROWSER-DEMO');
        await expect(page.getByText('SIMULATED — NOT GATEWAY VERIFIED.')).toBeVisible();
        await page.getByRole('button', { name: 'Simulate presentation payment' }).click();
        await expect(page.getByText('No gateway verification or server-side payment update occurred.')).toBeVisible();
        const denied = await page.evaluate(async token => fetch('/api/water/admin/stats', { headers: { Authorization: `Bearer ${token}` } }).then(response => response.status), citizenToken);
        expect(denied).toBe(403);
        expect(serverFailures, `unexpected API failures:\n${serverFailures.join('\n')}`).toEqual([]);
        expect(pageErrors, `browser page errors:\n${pageErrors.join('\n')}`).toEqual([]);
    });

    test('admin authentication, every admin URL, report domains, filters, and Water dashboard use real APIs', async ({ page }) => {
        const serverFailures = [];
        const pageErrors = [];
        page.on('pageerror', error => pageErrors.push(error.message));
        page.on('response', response => { if (response.url().includes('/api/') && (response.status() >= 500 || response.status() === 429)) serverFailures.push(`${response.status()} ${response.url()}`); });
        await page.goto('/index.html#admin');
        await page.locator('#admin-email').fill('admin.demo@nationx.test');
        await page.locator('#admin-password').fill('NationX-Admin-2026!');
        await page.getByRole('button', { name: /Sign In to Admin Panel/ }).click();
        await expect(page.locator('.swal2-confirm')).toBeVisible(); await confirmAlert(page);
        await expect(page).toHaveURL(/reports\.html/);

        for (const route of adminRoutes) await assertReactDocument(page, route);
        await page.goto('/reports.html');
        for (const section of ['overview', 'users', 'services', 'land', 'community', 'shop', 'market', 'education', 'admissions', 'stipends', 'notices', 'agriculture', 'tax', 'audit']) {
            await page.getByRole('button', { name: section, exact: true }).click();
            await expect(page.getByText(new RegExp(`Loading ${section} administration`))).toHaveCount(0, { timeout: 15000 });
            await expect(page.locator('.react-dashboard-error')).toHaveCount(0);
        }
        await page.getByRole('button', { name: 'users', exact: true }).click();
        const search = page.getByLabel('Search Citizens');
        await expect(search).toBeVisible(); await search.fill('alice.demo@nationx.test');
        await expect(page.getByRole('cell', { name: 'alice.demo@nationx.test' }).first()).toBeVisible();
        await page.goto('/admin-water.html');
        await expect(page.getByRole('heading', { name: 'Water administration' })).toBeVisible();
        await page.getByRole('button', { name: 'connections', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'connections' })).toBeVisible();
        expect(serverFailures, `unexpected API failures:\n${serverFailures.join('\n')}`).toEqual([]);
        expect(pageErrors, `browser page errors:\n${pageErrors.join('\n')}`).toEqual([]);
    });
});
