const { test, expect } = require('@playwright/test');

test('landing: desktop 3D, anchors, public back navigation and no public API calls', async ({ page }) => {
  const errors = [], api = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('/api/')) api.push(request.url()); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/index.html');
  await expect(page.locator('.nx-scene-ready')).toBeVisible();
  await page.getByRole('link', { name: 'Explore services', exact: false }).click();
  await expect(page.locator('#services')).toBeFocused();
  await expect(page).toHaveURL(/#services$/);
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'Sign in to NationX' }).click();
  await expect(page.getByRole('button', { name: /Login to Portal/ })).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/nx-landing-body/);
  await page.goBack();
  await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Bangladesh,');
  await expect(page.locator('.nx-scene-ready')).toBeVisible();
  await page.locator('canvas').evaluate(canvas => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await expect(page.locator('.nx-landscape-poster')).toHaveCSS('opacity', '1');
  await expect(page.locator('.nx-cinematic')).toHaveAttribute('data-motion', 'false');
  const destinations = await page.locator('.nx-service-row, .nx-section-intro .nx-text-link').evaluateAll(links => links.map(link => link.getAttribute('href')));
  for (const destination of destinations) {
    await page.goto(destination);
    await expect(page.getByRole('button', { name: /Login to Portal/ })).toBeVisible();
  }
  await page.goto('/index.html#admin');
  await expect(page.getByRole('button', { name: /Sign In to Admin Panel/ })).toBeVisible();
  await page.getByRole('button', { name: /Citizen/ }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: /Login to Portal/ })).toBeVisible();
  expect(api).toEqual([]); expect(errors).toEqual([]);
});

test('landing: mobile/tablet, reduced motion, keyboard menu and WebGL fallback', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) { return type.startsWith('webgl') ? null : original.call(this, type, ...args); };
  });
  for (const width of [360, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/index.html');
    await expect(page.locator('.nx-landscape-poster')).toHaveCSS('opacity', '1');
    await expect(page.locator('.nx-cinematic')).toHaveAttribute('data-motion', 'false');
    expect(await page.locator('.nx-cinematic').evaluate(el => el.offsetHeight)).toBeLessThan(1201);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('.nx-scan-line')).toHaveCSS('animation-name', 'none');
    if (width < 760) {
      const toggle = page.locator('button[aria-controls="nx-nav-links"]');
      await toggle.click(); await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Escape'); await expect(toggle).toBeFocused();
      await toggle.click(); await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Medicine Identifier' }).click();
      await expect(page.locator('#medicine')).toBeFocused();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    }
  }
});

test('landing: five camera compositions, native forward/reverse scroll and non-overlapping links', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/index.html');
  await expect(page.locator('.nx-cinematic')).toHaveAttribute('data-motion', 'true');
  const cameras = [];
  async function seek(progress) {
    await page.evaluate(progress => {
      const section = document.querySelector('.nx-cinematic'), stage = document.querySelector('.nx-stage');
      scrollTo({ top: section.getBoundingClientRect().top + scrollY + progress * (section.offsetHeight - stage.clientHeight), behavior: 'instant' });
    }, progress);
    await expect.poll(async () => Number(await page.locator('canvas').getAttribute('data-progress'))).toBeCloseTo(progress, 2);
  }
  for (const progress of [0, .25, .55, .8, 1]) {
    await seek(progress);
    cameras.push(await page.locator('canvas').getAttribute('data-camera'));
    await page.screenshot({ path: testInfo.outputPath(`scene-${Math.round(progress * 100)}.png`) });
    expect(await page.locator('.nx-stage').evaluate(el => Math.abs(el.getBoundingClientRect().top))).toBeLessThan(2);
    const bounds = await page.evaluate(() => {
      const panel = document.querySelector('[data-scene-panel][aria-hidden="false"]')?.getBoundingClientRect();
      return [...document.querySelectorAll('.nx-place[aria-hidden="false"]')].map(link => {
        const r = link.getBoundingClientRect();
        return { inside: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, overlaps: panel && r.left < panel.right && r.right > panel.left && r.top < panel.bottom && r.bottom > panel.top };
      });
    });
    expect(bounds.every(bound => bound.inside && !bound.overlaps)).toBe(true);
  }
  expect(new Set(cameras).size).toBe(5);
  for (const [i, progress] of [1, .8, .55, .25, 0].entries()) { await seek(progress); expect(await page.locator('canvas').getAttribute('data-camera')).toBe(cameras[4 - i]); }
  await seek(.8);
  for (const [name, href] of [['Identity', '/documents.html'], ['Health', '/health.html'], ['Education', '/education.html']]) {
    await expect(page.locator('.nx-place').filter({ hasText: name })).toBeVisible();
    await expect(page.locator('.nx-place').filter({ hasText: name })).toHaveAttribute('href', href);
  }
  await page.locator('.nx-place').filter({ hasText: 'Health' }).click();
  await expect(page.getByRole('button', { name: /Login to Portal/ })).toBeVisible();
});

test('landing: initial WebGL failure retains content without an inactive scroll tunnel', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
  await page.goto('/index.html');
  await expect(page.locator('.nx-landscape')).toHaveAttribute('data-renderer', 'webgl-unavailable');
  await expect(page.locator('.nx-static-note')).toContainText('Still landscape');
  await expect(page.locator('.nx-cinematic')).toHaveAttribute('data-motion', 'false');
  expect(await page.locator('.nx-cinematic').evaluate(el => el.offsetHeight)).toBe(900);
  await page.getByRole('link', { name: 'Explore services', exact: false }).click();
  await expect(page.locator('#services')).toBeFocused();
});

test('landing: synthetic citizen sign-in and existing Health/Medicine route', async ({ page }) => {
  await page.goto('/index.html#signin');
  await page.locator('#citizen-email').fill('alice.demo@nationx.test');
  await page.locator('#citizen-password').fill('NationX-Demo-2026!');
  await page.getByRole('button', { name: /Login to Portal/ }).click();
  await expect(page.locator('.swal2-confirm')).toBeVisible();
  await expect(page.locator('.swal2-title')).toHaveText('Login Successful!');
  await page.locator('.swal2-confirm').click();
  await expect(page).toHaveURL(/dashboard\.html/);
  await page.goto('/index.html');
  await page.getByRole('link', { name: 'Explore Medicine Identifier' }).click();
  await expect(page).toHaveURL(/health\.html\?section=medicine-identifier/);
  await expect(page.locator('.medicine-identifier')).toBeVisible();
  await page.reload(); await expect(page.locator('.medicine-identifier')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/nx-landing-body/);
});
