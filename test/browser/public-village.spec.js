const { test, expect } = require('@playwright/test');

test('village story: seasons, keyboard control, animated scene and pause', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/index.html#village');
  const scene = page.locator('.nx-season-scene .nx-village-art');
  await expect(scene).toHaveClass(/is-rendered/);
  await page.getByRole('tab', { name: /Monsoon/ }).click();
  await expect(page.getByRole('tabpanel')).toHaveAttribute('data-season', 'monsoon');
  await expect(scene).toHaveAttribute('data-mood', 'monsoon');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'শরৎ Autumn', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Pause village animation' }).click();
  await expect(scene).toHaveClass(/is-paused/);
  // Compare actual rendered pixels, not an artificial frame counter.
  const canvas = scene.locator('canvas');
  await page.waitForTimeout(150);
  const still = await canvas.screenshot();
  await page.waitForTimeout(250);
  expect((await canvas.screenshot()).equals(still)).toBe(true);
  await page.getByRole('button', { name: 'Play village animation' }).click();
  await page.waitForTimeout(250);
  expect((await canvas.screenshot()).equals(still)).toBe(false);
  await page.locator('summary').filter({ hasText: 'Can I register without an NID?' }).click();
  await expect(page.locator('.nx-question-list details[open]')).toContainText('Applicant login');
  expect(errors).toEqual([]);
});

test('courtyard login: lighting, reveal, applicant routing and admin access', async ({ page }) => {
  const requests = [];
  // Routing uses the role claim. This synthetic token is only used with mocked APIs.
  const applicantToken = `preview.${Buffer.from(JSON.stringify({ id: 1, principal_type: 'NID_APPLICANT' })).toString('base64url')}.signature`;
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    requests.push({ path, body: route.request().postDataJSON() });
    if (path === '/api/applicants/login') return route.fulfill({ json: { token: applicantToken } });
    if (path === '/api/applicants/me') return route.fulfill({ json: { id: 1, name: 'Example Applicant', email: 'applicant@example.test', contact_verified_at: null } });
    if (path === '/api/nid/first-time-applications/current') return route.fulfill({ contentType: 'application/json', body: 'null' });
    if (path === '/api/admin/access/options') return route.fulfill({ json: { domains: [], divisions: [] } });
    return route.fulfill({ json: {} });
  });
  await page.goto('/index.html#signin');
  await expect(page.locator('.nx-courtyard-window .nx-village-art')).toHaveClass(/is-rendered/);
  await page.getByLabel('Email Address', { exact: true }).fill('applicant@example.test');
  await page.getByLabel('Password', { exact: true }).fill('example-password');
  await page.getByRole('button', { name: 'Dusk', exact: true }).click();
  await expect(page.locator('.nx-village-login')).toHaveClass(/is-dusk/);
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.locator('#citizen-password')).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(page.locator('#citizen-password')).toHaveAttribute('type', 'password');
  await page.locator('.applicant-login-option').click();
  await expect(page.getByRole('checkbox', { name: /Applicant login/ })).toBeChecked();
  await page.getByRole('button', { name: 'Login to Portal' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome home.' })).toBeVisible();
  expect(requests.find(r => r.path === '/api/applicants/login')?.body).toEqual({ email: 'applicant@example.test', password: 'example-password' });
  await page.getByRole('button', { name: /Continue to your workspace/ }).click();
  await expect(page).toHaveURL(/nid-applicant\.html/);
  await page.goto('/index.html#admin');
  await expect(page.getByRole('heading', { name: 'Admin Portal' })).toBeVisible();
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(page.getByLabel('Service Responsibility', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Citizen', exact: true }).click();
  await expect(page).toHaveURL(/#signin$/);
  await expect(page.getByRole('button', { name: 'Login to Portal' })).toBeVisible();
  await page.getByRole('link', { name: /Back to Bangladesh/ }).click();
  await expect(page.locator('body')).not.toHaveClass(/nx-village-login-body/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Bangladesh,');
});

test('public designs: responsive layouts, reduced motion and WebGL fallback', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) { return type.startsWith('webgl') ? null : original.call(this, type, ...args); };
  });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/index.html#signin');
    await expect(page.getByRole('button', { name: 'Login to Portal' })).toBeVisible();
    await expect(page.locator('.nx-village-poster')).toHaveCSS('opacity', '0.8');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goto('/index.html#village');
    await expect(page.getByRole('tabpanel')).toBeVisible();
    await expect(page.locator('.nx-season-scene .nx-village-poster')).toHaveCSS('opacity', '0.8');
    await expect(page.locator('.nx-season-scene .nx-village-sun')).toHaveCSS('animation-name', 'none');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
