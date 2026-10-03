const { test, expect } = require('@playwright/test');

const ministries = ['nid', 'passport', 'health', 'water', 'tax', 'education', 'land', 'agriculture'];
const citizenPages = [
  'dashboard', 'profile', 'documents', 'history', 'events', 'contact', 'market', 'todo',
  'community', 'shop', ...ministries
];

const stipends = [
  { id: 1, title: 'Excellence in Science Scholarship', description: 'Award for students securing GPA 5.0.', amount: 10000, deadline: '2026-06-30', min_gpa: 5 },
  { id: 2, title: 'Research Grant for Undergraduates', description: 'Support for innovative research projects.', amount: 25000, deadline: '2026-09-15', min_gpa: 3.5 },
  { id: 3, title: "Prime Minister’s Education Trust", description: 'Assistance for meritorious students.', amount: 5000, deadline: '2026-12-31', min_gpa: 4.5, max_income: 300000 }
];

function responseFor(path) {
  if (path === '/api/stipends') return stipends;
  if (path.includes('/education/years')) return [2026, 2025];
  if (path.endsWith('/summary')) return { user: { name: 'Visual Test Citizen', nid: 'DEMO-NID' }, stats: {} };
  if (path === '/api/user/profile') return { name: 'Visual Test Citizen', nid: 'DEMO-NID' };
  if (path === '/api/nid/dashboard') return { stats: {}, profile: {}, recentApplications: [] };
  if (path === '/api/nid/profile') return { exists: false, based_on_registration: {} };
  if (/\/tin\/status$|\/vat\/status$/.test(path)) return null;
  if (/stats$|dashboard$/.test(path)) return {};
  if (path === '/api/medicine-scans') return { scans: [] };
  return [];
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('token', 'visual-quality-fixture'));
  await page.route('**/api/**', route => route.fulfill({ json: responseFor(new URL(route.request().url()).pathname) }));
});

test('four citizen ministries use four distinct, valid Bangladesh village backgrounds', async ({ page }) => {
  const backgrounds = new Set();
  for (const ministry of ['nid', 'passport', 'health', 'education']) {
    await page.goto(`/${ministry}.html`);
    const shell = page.locator(`.nx-ministry-${ministry}`);
    await expect(shell).toBeVisible();
    const background = await shell.evaluate(element => getComputedStyle(element).backgroundImage);
    expect(background).toContain(`${ministry}-village-background.webp`);
    backgrounds.add(background);
    const image = await page.evaluate(async source => {
      const element = new Image();
      element.src = source;
      await element.decode();
      return { width: element.naturalWidth, height: element.naturalHeight };
    }, `/images/${ministry}-village-background.webp`);
    expect(image.width).toBeGreaterThanOrEqual(1400);
    expect(image.width / image.height).toBeGreaterThan(1.6);
  }
  expect(backgrounds.size).toBe(4);
});

test('stipend cards show one deadline and keep the action inside every card', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/education.html?section=stipend');
  const cards = page.locator('.react-service-card-grid > article');
  await expect(cards).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    const card = cards.nth(index);
    await expect(card.getByText('Deadline', { exact: true })).toHaveCount(1);
    await expect(card.getByRole('button', { name: 'Apply now' })).toBeVisible();
    const geometry = await card.evaluate(element => {
      const outer = element.getBoundingClientRect();
      const button = element.querySelector('button').getBoundingClientRect();
      return { contained: button.left >= outer.left && button.right <= outer.right && button.bottom <= outer.bottom + 1 };
    });
    expect(geometry.contained).toBe(true);
  }
});

for (const width of [1440, 390]) {
  test(`assistant stays compact and opens accessibly at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/health.html');
    const launcher = page.getByRole('button', { name: /Open Voice assistant/ });
    await expect(launcher).toBeVisible();
    const box = await launcher.boundingBox();
    expect(box.width).toBeLessThanOrEqual(60);
    expect(box.height).toBeLessThanOrEqual(60);
    await launcher.click();
    await expect(page.getByRole('region', { name: 'NationX voice assistant' })).toBeVisible();
    await page.getByRole('button', { name: 'Close assistant', exact: true }).click();
    await expect(page.getByRole('region', { name: 'NationX voice assistant' })).not.toBeVisible();
  });
}

test('all citizen pages render without browser errors, broken images, or horizontal overflow', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of citizenPages) {
      await page.goto(`/${name}.html`);
      await expect(page.locator('#root')).toContainText(/\S/);
      const problems = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        brokenImages: [...document.images].filter(image => image.complete && image.naturalWidth === 0).map(image => image.src)
      }));
      expect(problems, `${name} at ${width}px`).toEqual({ overflow: false, brokenImages: [] });
    }
  }
  expect(errors).toEqual([]);
});

test('mobile ministry navigation remains keyboard operable and closes after selection', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/passport.html');
  const toggle = page.getByRole('button', { name: 'Toggle navigation' });
  await toggle.focus();
  await page.keyboard.press('Enter');
  const navigation = page.getByRole('navigation', { name: 'passport services', exact: true });
  await expect(navigation).toBeVisible();
  const documents = navigation.locator('a[href="?section=documents"]');
  await documents.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/section=documents/);
  await expect(page.locator('#citizen-sidebar')).not.toBeInViewport();
});

test('service controls meet touch size and stay inside the viewport on phones', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const ministry of ministries) {
    await page.goto(`/${ministry}.html`);
    const issues = await page.locator('main').evaluate(main => [...main.querySelectorAll('button,input,select,textarea')]
      .filter(element => {
        const box = element.getBoundingClientRect();
        if (!box.width || !box.height || ['hidden', 'checkbox', 'radio', 'file'].includes(element.type)) return false;
        return box.height < 44 || (!element.closest('.nx-section-tabs') && (box.left < -1 || box.right > innerWidth + 1));
      })
      .map(element => `${element.tagName}:${element.name || element.textContent.trim()}`));
    expect(issues, ministry).toEqual([]);
  }
});

test('reduced-motion preference disables decorative animation while retaining content', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('token', 'visual-quality-fixture'));
  await page.route('**/api/**', route => route.fulfill({ json: responseFor(new URL(route.request().url()).pathname) }));
  await page.goto('/education.html');
  await expect(page.getByRole('heading', { name: 'Education Services' })).toBeVisible();
  const animation = await page.locator('.nationx-ministry-page').evaluate(element => getComputedStyle(element).animationName);
  expect(animation).toBe('none');
  await context.close();
});
