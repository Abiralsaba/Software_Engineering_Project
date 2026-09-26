const { test, expect } = require('@playwright/test');

// Synthetic responses exercise React navigation/layout without touching citizen data.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('token', 'ministry-layout-fixture'));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    let data = [];
    if (path === '/api/user/profile') data = { name: 'Preview Citizen', nid: 'DEMO-NID' };
    else if (path === '/api/nid/dashboard') data = { stats: {}, profile: {}, recentApplications: [] };
    else if (path === '/api/nid/profile') data = { exists: false, based_on_registration: {} };
    else if (/stats$|dashboard$/.test(path)) data = {};
    else if (/\/tin\/status$|\/vat\/status$/.test(path)) data = null;
    else if (path === '/api/medicine-scans') data = { scans: [] };
    return route.fulfill({ body: JSON.stringify(data), contentType: 'application/json' });
  });
});

const pages = [
  ['health', 'Digital Health Card', 'Apply for health card'],
  ['agriculture', 'Subsidies', ''],
  ['nid', 'NID Correction', 'Submit correction'],
  ['passport', 'Apply for e-Passport', 'Passport application'],
  ['water', 'Water Connection', ''],
  ['land', 'Land Records', 'Add land record'],
  ['tax', 'Tax Calculator', ''],
  ['education', 'Stipends & Grants', '']
];

for (const width of [1440, 390]) {
  for (const [ministry] of pages) {
    test(`${ministry}: every service section has consistent controls at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/${ministry}.html`);
      const navigation = page.getByRole('navigation', { name: `${ministry} services`, exact: true });
      await expect(navigation).toBeAttached();
      const sections = await navigation.locator('a[href^="?"]').evaluateAll(elements => elements.map(e => e.getAttribute('href')));
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      for (const section of sections) {
        if (width < 900) await page.getByRole('button', { name: 'Toggle navigation' }).click();
        await navigation.locator(`a[href="${section}"]`).click();
        await expect(navigation.locator(`a[href="${section}"]`)).toHaveAttribute('aria-current', 'page');
        if (width < 900) await expect(page.locator('#citizen-sidebar')).not.toBeInViewport();
        const problems = await page.locator('main').evaluate(main => {
          const issues = [];
          for (const element of main.querySelectorAll('input,select,textarea,button')) {
            const box = element.getBoundingClientRect();
            if (!box.width || !box.height || ['hidden', 'checkbox', 'radio', 'file'].includes(element.type)) continue;
            if (box.height < 44) issues.push(`${element.tagName} ${element.name || element.textContent}: height ${box.height}`);
            if (!element.closest('.nx-section-tabs') && (box.right > innerWidth + 1 || box.left < -1)) issues.push(`${element.tagName} outside viewport`);
            if (element.tagName === 'SELECT' && element.parentElement.tagName === 'LABEL' && box.width < element.parentElement.getBoundingClientRect().width - 3) issues.push(`${element.name}: narrow dropdown`);
          }
          if (document.documentElement.scrollWidth > innerWidth) issues.push('Horizontal page overflow');
          return issues;
        });
        expect(problems, `${ministry}${section} at ${width}`).toEqual([]);
        await page.screenshot({ path: testInfo.outputPath(`${ministry}-${section.slice(9)}-${width}.png`), fullPage: true, animations: 'disabled' });
      }
      expect(errors).toEqual([]);
    });
  }
}

test('demo checkout supports payment methods, success, decline and cancellation without writes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const writes = [];
  page.on('request', request => { if (request.method() !== 'GET' && request.url().includes('/api/')) writes.push(request.url()); });
  await page.goto('/land.html?section=tax');
  for (const [button, result] of [['Simulate presentation payment', 'Simulation completed'], ['Simulate declined payment', 'Demo payment declined'], ['Cancel demo checkout', 'Demo checkout cancelled']]) {
    await page.getByLabel('Demo amount (BDT)').fill('1500');
    await page.getByRole('button', { name: 'Open demo checkout' }).click();
    await page.getByRole('radio', { name: 'Mobile banking' }).check();
    await expect(page.locator('.nx-payment-method').first()).toHaveCSS('flex-direction', 'row');
    await page.getByRole('button', { name: button, exact: true }).click();
    await expect(page.getByRole('status')).toContainText(result);
    await expect(page.getByRole('status')).toContainText('NOT A PAYMENT RECEIPT');
    await page.getByRole('button', { name: 'Start another demo' }).click();
  }
  expect(writes).toEqual([]);
});

for (const width of [1440, 390]) {
  for (const [ministry, service, heading] of pages) {
    test(`${ministry}: original design and React service navigation at ${width}px`, async ({ page }, testInfo) => {
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/${ministry}.html`);
      const shell = page.locator(`.nx-ministry-${ministry}`);
      await expect(shell.locator('h1')).toBeVisible();
      await expect(page.locator('body')).toHaveClass(/nx-ministry-body/);
      if (ministry !== 'education') await expect(shell).toHaveCSS('background-image', /url/);
      await page.screenshot({ path: testInfo.outputPath(`${ministry}-${width}.png`), fullPage: true });
      if (width < 900) await page.getByRole('button', { name: 'Toggle navigation' }).click();
      await page.getByRole('navigation', { name: `${ministry} services`, exact: true }).getByRole('link', { name: service, exact: true }).click();
      if (heading) await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      await expect(page).toHaveURL(/section=/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.getByRole('button', { name: /Voice assistant/ }).click();
      await expect(page.getByRole('region', { name: 'NationX voice assistant' })).toBeVisible();
      await page.getByRole('button', { name: 'Close assistant', exact: true }).click();
      if (width < 900) await page.getByRole('button', { name: 'Toggle navigation' }).click();
      await page.getByRole('link', { name: 'Back to Dashboard', exact: true }).click();
      await expect(page.locator('body')).not.toHaveClass(/nx-ministry-body/);
      expect(errors).toEqual([]);
    });
  }
}

test('health service card opens the preserved medicine scanner', async ({ page }) => {
  await page.goto('/health.html');
  await page.getByRole('button', { name: 'Open service : Medicine Identifier' }).click();
  await expect(page.getByRole('heading', { name: 'Medicine Identifier', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Manual catalogue search' })).toBeVisible();
  await expect(page.locator('input[type=file]')).toHaveCount(2);
});
