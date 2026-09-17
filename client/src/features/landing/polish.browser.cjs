// Run with Playwright against a running frontend; no database fixture writes.
const { test, expect } = require('@playwright/test');

test('landing polish: midway reload, reverse scroll and live responsive/reduced-motion changes', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/index.html');
  await expect(page.locator('.nx-scene-ready')).toBeVisible();
  async function seek(progress) {
    await page.evaluate(p => {
      const section = document.querySelector('.nx-cinematic'), stage = document.querySelector('.nx-stage');
      scrollTo({ top: section.offsetTop + p * (section.offsetHeight - stage.clientHeight), behavior: 'instant' });
    }, progress);
    await expect.poll(async () => Number(await page.locator('canvas').getAttribute('data-progress'))).toBeCloseTo(progress, 2);
  }
  await seek(.65);
  await page.reload();
  await expect(page.locator('.nx-scene-ready')).toBeVisible();
  await expect.poll(async () => Number(await page.locator('canvas').getAttribute('data-progress'))).toBeCloseTo(.65, 2);
  for (const p of [.98, .11, .81, .35, 0]) await seek(p);
  for (const width of [768, 390, 320, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => scrollTo(0, 0));
    await expect(page.locator('.nx-scene-ready')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.nx-landscape')).toHaveAttribute('data-renderer', 'reduced-motion');
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.locator('.nx-cinematic')).toHaveAttribute('data-motion', 'false');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('.nx-scene-ready')).toBeVisible();
  await expect(page.locator('.nx-cinematic')).toHaveAttribute('data-motion', 'true');
  await page.getByRole('link', { name: 'Explore services', exact: false }).click();
  await expect(page.locator('#services')).toBeFocused();
  await page.reload();
  await expect(page.locator('#services')).toBeInViewport();
  expect(errors).toEqual([]);
});

test('landing polish: continuous scroll walkthrough and medicine destination', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/index.html');
  await expect(page.locator('.nx-scene-ready')).toBeVisible();
  // Native scrolling, recorded by Playwright when video is enabled.
  await page.evaluate(async () => {
    const section = document.querySelector('.nx-cinematic'), stage = document.querySelector('.nx-stage');
    const distance = section.offsetHeight - stage.clientHeight;
    const sweep = reverse => new Promise(resolve => {
      let start;
      function frame(now) {
        start ??= now;
        const t = Math.min(1, (now - start) / 7000);
        scrollTo(0, section.offsetTop + distance * (reverse ? 1-t : t));
        if(t < 1) requestAnimationFrame(frame); else resolve();
      }
      requestAnimationFrame(frame);
    });
    await sweep(false); await sweep(true);
  });
  await page.locator('#medicine').scrollIntoViewIfNeeded();
  const link = page.getByRole('link', { name: 'Explore Medicine Identifier' });
  await expect(link).toHaveAttribute('href', '/health.html?section=medicine-identifier');
  await link.click();
  await expect(page.getByRole('button', { name: /Login to Portal/ })).toBeVisible();
});
