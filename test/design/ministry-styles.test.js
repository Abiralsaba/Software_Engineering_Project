const { test } = require('node:test');
const assert = require('node:assert/strict');

test('national palette preserves semantic red, amber, opacity and white', async () => {
  const { bangladeshColors } = await import('../../client/legacy-ministry-styles.js');
  assert.equal(bangladeshColors('#f42a41 #f59e0b #fff'), '#f42a41 #f59e0b #ffffff');
  assert.equal(bangladeshColors('rgba(15, 23, 42, .75)'), 'rgba(15, 42, 35, .75)');
});

test('all original designs are scoped with original artwork and isolated animations', async () => {
  const { legacyMinistryStyles } = await import('../../client/legacy-ministry-styles.js');
  const css = legacyMinistryStyles().load.call({ addWatchFile() {} }, '\0legacy-ministry.css');
  for (const ministry of ['land', 'agriculture', 'health', 'water', 'nid', 'passport', 'tax', 'education']) {
    assert.ok(css.includes(`.nationx-ministry-page.nx-ministry-${ministry}`));
  }
  assert.ok(css.includes('/images/health_bg.png'));
  assert.ok(css.includes('@keyframes nx-health-'));
  assert.ok(!css.includes("url('../images/"));
  assert.ok(!/^\s*body\s*\{/m.test(css));
  assert.ok(!css.includes('.nx-ministry-tax * {'));
});
