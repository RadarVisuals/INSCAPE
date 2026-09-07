import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import createQr from 'qrcode-generator';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5174';
test('Library drops replace Identity artwork, shader animates, and Display stays unchanged', async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      const assetPath = url.pathname.indexOf('/public/assets/');
      if (url.hostname === 'raw.githubusercontent.com' && assetPath >= 0) {
        return route.fulfill({ response: await route.fetch({ url: `${origin}${url.pathname.slice(assetPath + 7)}` }) });
      }
      return route.abort();
    });
    await page.goto(`${origin}/development/owner/system-workflow`);
    await page.locator('.system-workflow').waitFor();
    await page.evaluate(() => {
      window.__identityWrites = 0; addEventListener('inscape:review-storage-write', () => window.__identityWrites++);
      window.__cloudDraws = 0; const original = WebGLRenderingContext.prototype.drawArrays;
      WebGLRenderingContext.prototype.drawArrays = function (...args) { window.__cloudDraws++; return original.apply(this, args); };
    });
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.locator('[data-identity-dossier-source]').click();
    assert.equal(await page.locator('.identity-module__clouds').count(), 0, 'official fallback has a plain background');
    await page.getByLabel('Move Identity window', { exact: true }).focus();
    for (let i = 0; i < 12; i++) await page.keyboard.press('Shift+ArrowRight');
    const placementIds = await page.locator('[data-system-workflow-placement-id]').evaluateAll(nodes => nodes.map(n => n.dataset.systemWorkflowPlacementId));
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    const source = page.getByRole('button', { name: 'SKULL REAPER / INSCAPE STUDIES', exact: true });
    await source.waitFor();
    await source.scrollIntoViewIfNeeded();
    await source.locator('img').evaluate(img => img.complete && img.naturalWidth > 0 ? undefined : new Promise(resolve => img.addEventListener('load', resolve, { once: true })));
    await page.waitForTimeout(100);
    const from = await source.boundingBox(), to = await page.locator('.identity-module__portrait').boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + 30); await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 18 });
    await page.getByText('Release to replace Identity artwork', { exact: true }).waitFor();
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelector('.identity-module__portrait img')?.src.includes('skull_reaper'));
    assert.equal(await page.evaluate(() => window.__identityWrites), 1);
    const canvas = page.locator('.identity-module__clouds[data-shader="ready"]');
    await canvas.waitFor();
    const first = await canvas.screenshot(); await page.waitForTimeout(250);
    assert.notDeepEqual(await canvas.screenshot(), first, 'cloud pixels animate');
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(200);
    const still = await canvas.screenshot(); await page.waitForTimeout(200);
    assert.deepEqual(await canvas.screenshot(), still, 'reduced motion stays still');
    assert.deepEqual(await page.locator('[data-system-workflow-placement-id]').evaluateAll(nodes => nodes.map(n => n.dataset.systemWorkflowPlacementId)), placementIds);
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(250);
      const content = page.locator('.identity-module .system-workflow__instrument-content');
      assert.equal(await content.evaluate(n => n.scrollWidth <= n.clientWidth + 1), true);
      await page.screenshot({ path: `.browser-test-runtime/identity-artwork-${width}.png` });
    }
    await page.getByRole('button', { name: 'Close Identity', exact: true }).click();
    const draws = await page.evaluate(() => window.__cloudDraws); await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.__cloudDraws), draws);
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.locator('[data-identity-dossier-source]').click();
    assert.match(await page.locator('.identity-module__portrait img').getAttribute('src'), /skull_reaper/);
    await page.getByRole('button', { name: 'Expand INSCAPE details' }).click();
    await page.getByText('Identity artwork', { exact: true }).click();
    await page.getByRole('button', { name: 'Use Universal Profile image' }).click();
    assert.equal(await page.evaluate(() => window.__identityWrites), 2);
    await page.unrouteAll({ behavior: 'wait' });
  } finally { await browser.close(); }
});
test('published Identity uses the shared chrome without blocking Grid navigation', async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await page.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/browser-tests/fixture.html?view=0x1111111111111111111111111111111111111111&runtime=grid`);
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.locator('[data-identity-dossier-source]').click();
    const identity = page.locator('.identity-module aside');
    await identity.waitFor();
    assert.match(await identity.innerText(), /Alpha Visitor Fixture/i);
    await page.getByRole('button', { name: 'Next Grid', exact: true }).click();
    assert.equal(await identity.count(), 1);
    assert.equal(await identity.getAttribute('aria-modal'), null);
    const chrome = await identity.evaluate(node => ({ radius: getComputedStyle(node).borderRadius,
      grain: getComputedStyle(node, '::after').backgroundImage,
      control: getComputedStyle(node.querySelector('[aria-label="Close Identity"]')).width }));
    assert.equal(chrome.radius, '10px'); assert.match(chrome.grain, /grain-mono/); assert.equal(chrome.control, '20px');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(250);
      const bounds = await identity.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
      if (process.env.INSCAPE_CAPTURE) await page.screenshot({ path: `.browser-test-runtime/identity-public-${width}.png` });
    }
    await page.getByRole('button', { name: 'Close Identity', exact: true }).focus();
    await page.keyboard.press('Escape');
    await identity.waitFor({ state: 'detached' });
    assert.equal(await page.getByRole('button', { name: 'Profile', exact: true }).evaluate(node => node === document.activeElement), true);
  } finally { await browser.close(); }
});
test('owner opens Identity, keeps it while using Library, and closes without draft writes', async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await page.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/development/owner/system-workflow`);
    await page.locator('.system-workflow').waitFor();
    await page.evaluate(() => { window.__identityWrites = 0; addEventListener('inscape:review-storage-write', () => window.__identityWrites++); });
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.locator('[data-identity-dossier-source]').click();
    const identity = page.locator('.identity-module aside');
    await identity.waitFor();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(250);
      if (process.env.INSCAPE_CAPTURE) await page.screenshot({ path: `.browser-test-runtime/identity-owner-${width}.png` });
    }
    assert.equal(await identity.getByText('INSCAPE IDENTITY', { exact: true }).count(), 0);
    assert.equal(await identity.getByText('Drop Library artwork here', { exact: true }).count(), 0);
    assert.equal(await identity.getByRole('link', { name: 'INSCAPE PROFILE', exact: true }).count(), 0);
    assert.equal(await identity.locator('.identity-module__identifier').innerText(), '#1111');
    assert.equal(await identity.getByRole('link', { name: 'Open official Universal Profile' }).getAttribute('href'),
      'https://universaleverything.io/0x1111111111111111111111111111111111111111');
    const copy = identity.getByRole('button', { name: 'Copy profile address', exact: true });
    const icons = await identity.evaluate(node => ['.identity-module__source-link svg', '.identity-module__address-control svg'].map(selector => {
      const style = getComputedStyle(node.querySelector(selector)); return [style.color, style.strokeWidth, style.marginLeft];
    }));
    assert.deepEqual(icons[0], icons[1]);
    await identity.getByRole('button', { name: 'Show address QR code' }).click();
    const qr = page.getByRole('dialog', { name: 'Share profile address' });
    await qr.locator('img').waitFor();
    const expectedQr = createQr(0, 'M');
    expectedQr.addData('0x1111111111111111111111111111111111111111'); expectedQr.make();
    assert.equal(await qr.locator('img').getAttribute('src'), expectedQr.createDataURL(6));
    assert.equal(await qr.locator('code').innerText(), '0x1111111111111111111111111111111111111111');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const bounds = await qr.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
      await page.screenshot({ path: `.browser-test-runtime/identity-qr-${width}.png` });
    }
    await qr.getByRole('button', { name: 'Close QR code' }).focus();
    await page.keyboard.press('Escape');
    await qr.waitFor({ state: 'hidden' });
    assert.equal(await identity.count(), 1);
    await copy.focus();
    await identity.locator('.identity-module__address-tooltip').waitFor();
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true,
      value: { writeText: async text => { window.__copiedIdentityAddress = text; } } }));
    const beforeCopy = await identity.boundingBox();
    await copy.click();
    await identity.getByRole('button', { name: 'Address copied', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__copiedIdentityAddress), '0x1111111111111111111111111111111111111111');
    assert.deepEqual(await identity.boundingBox(), beforeCopy);
    await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('Denied'); }; });
    await identity.getByRole('button', { name: 'Address copied', exact: true }).click();
    await identity.getByText('Copy failed — use the full address above.', { exact: true }).waitFor();
    assert.equal(await page.locator('.system-workflow__identity-primary').innerText(), 'DISPLAY MODULE');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: 'MOUNTAIN SIGNAL II', exact: true }).click();
    const placements = await page.locator('[data-system-workflow-placement-id]').count();
    await page.getByLabel('Move Identity window', { exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Delete');
    await page.keyboard.press('Space');
    assert.equal(await page.locator('[data-system-workflow-placement-id]').count(), placements);
    assert.equal(await page.evaluate(() => window.__identityWrites), 0);
    await page.getByRole('button', { name: 'Crop', exact: true }).click();
    const crop = page.getByRole('slider', { name: 'Crop zoom', exact: true });
    await crop.waitFor();
    const cropZoom = await crop.inputValue();
    await page.getByLabel('Move Identity window', { exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await crop.inputValue(), cropZoom);
    assert.equal(await page.evaluate(() => window.__identityWrites), 0);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    assert.equal(await identity.count(), 1);
    assert.equal(await page.locator('.system-workflow').getAttribute('inert'), null);
    await page.getByRole('button', { name: 'Close Identity', exact: true }).click();
    await identity.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => window.__identityWrites), 0);
    assert.equal(await page.getByRole('button', { name: 'Profile', exact: true }).evaluate(node => node === document.activeElement), true);
  } finally { await browser.close(); }
});
test('Display title follows the existing shortcut name and survives reload', async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await page.goto(`${origin}/development/owner/system-workflow`);
    await page.getByRole('button', { name: 'Minimize Display Module to shortcut' }).click();
    const shortcut = page.locator('.system-workflow__desktop-shortcut');
    await shortcut.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'RENAME', exact: true }).click();
    const input = page.getByRole('textbox', { name: 'Display Module shortcut name' });
    await input.fill('Lunar Desert'); await input.press('Enter');
    await shortcut.dblclick();
    await page.waitForFunction(() => document.querySelector('.system-workflow__identity-primary')?.textContent === 'Lunar Desert');
    await page.reload();
    await page.waitForFunction(() => document.querySelector('.system-workflow__identity-primary')?.textContent === 'Lunar Desert');
  } finally { await browser.close(); }
});

test('compact Identity expands downwards and saves only authored details', async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await page.goto(`${origin}/development/owner/system-workflow`);
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.locator('[data-identity-dossier-source]').click();
    const identity = page.locator('.identity-module aside');
    const officialName = await identity.locator('.identity-module__story h2').innerText();
    const before = await identity.boundingBox();
    await page.evaluate(() => { window.__identityWrites = 0; addEventListener('inscape:review-storage-write', () => window.__identityWrites++); });
    await page.getByRole('button', { name: 'Expand INSCAPE details' }).click();
    const expanded = await identity.boundingBox();
    assert.equal(expanded.y, before.y); assert.ok(expanded.height > before.height);
    const details = page.getByRole('region', { name: 'INSCAPE profile', exact: true });
    await details.getByRole('button', { name: 'Edit', exact: true }).click();
    await details.getByLabel('Title', { exact: true }).fill('Human Underneath');
    await details.getByLabel('Story', { exact: true }).fill('My illustrated world.');
    await details.getByLabel('Tags, separated by commas').fill('Illustration, Sound');
    await details.getByRole('button', { name: 'Save details' }).click();
    await details.getByRole('heading', { name: 'Human Underneath' }).waitFor();
    assert.equal(await page.evaluate(() => window.__identityWrites), 1);
    assert.equal(await identity.locator('.identity-module__story h2').innerText(), officialName);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({ path: `.browser-test-runtime/identity-expanded-${width}.png` });
      const content = identity.locator('.system-workflow__instrument-content');
      assert.equal(await content.evaluate(n => n.scrollWidth <= n.clientWidth + 1), true);
    }
    await page.getByRole('button', { name: 'Collapse INSCAPE details' }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    assert.equal((await identity.boundingBox()).height, before.height);
    assert.equal(await page.evaluate(() => window.__identityWrites), 1);
    // This development fixture deliberately uses in-memory storage; domain tests cover reload persistence.
    await page.getByRole('button', { name: 'Close Identity', exact: true }).click();
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.locator('[data-identity-dossier-source]').click();
    await page.getByRole('button', { name: 'Expand INSCAPE details' }).click();
    await page.getByRole('heading', { name: 'Human Underneath', exact: true }).waitFor();
  } finally { await browser.close(); }
});
test('Identity content and window are independent of the owner workspace', async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route('**/*', (route) => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/development/owner/system-workflow`);
    await page.locator('.system-workflow').waitFor();
    await page.evaluate(async () => {
      const { default: React } = await import('/@id/react');
      const { default: ReactDOM } = await import('/@id/react-dom/client');
      const { default: Identity } = await import('/src/public/identity/IdentityModule.jsx');
      const node = document.createElement('div'); document.querySelector('.system-workflow').append(node);
      const root = ReactDOM.createRoot(node);
      window.__renderIdentityTheme = (menuSurface) => root.render(React.createElement(Identity, { menuSurface, model: {
        address: '0x1111111111111111111111111111111111111111',
        profile: { displayName: 'Identity test', description: 'Existing biography', tags: [], avatarProvenance: 'INSCAPE_PUBLISHED_ASSET' },
        card: { version: 1, background: { type: 'clouds', color: '#7733cc', speed: 0.4 }, fields: [
          { id: 'field:role', label: 'Role', type: 'list', value: ['Artist', 'Writer'] },
          { id: 'field:location', label: 'Location', type: 'text', value: 'The Underneath' },
        ] },
        links: [
          { id: 'x1', label: 'Artist on X', url: 'https://x.com/artist' },
          { id: 'x2', label: 'Studio on X', url: 'https://twitter.com/studio' },
          { id: 'git', label: 'Source code', url: 'https://github.com/artist' },
          { id: 'web', label: 'Personal site', url: 'https://github.com.example.org/' },
        ], technical: [],
      }, onClose: () => root.unmount() }));
      window.__renderIdentityTheme('carbon');
    });
    const identity = page.getByRole('complementary', { name: 'Identity — Identity test' });
    await identity.waitFor();
    assert.match(await identity.innerText(), /Existing biography/);
    const links = identity.getByRole('navigation', { name: 'Profile links' });
    assert.equal(await links.getByRole('link', { name: 'Artist on X', exact: true }).locator('span:not(.identity-module__link-tooltip)').innerText(), 'Artist on X');
    const github = links.getByRole('link', { name: 'Source code', exact: true });
    assert.equal(await github.locator('svg.lucide-github').count(), 1);
    assert.equal(await github.locator('span:not(.identity-module__link-tooltip)').count(), 0);
    await github.focus();
    await github.locator('.identity-module__link-tooltip').waitFor();
    assert.equal(await links.getByRole('link', { name: 'Personal site', exact: true }).locator('svg.lucide-globe').count(), 1);
    await identity.getByRole('button', { name: 'Expand INSCAPE details' }).click();
    assert.equal(await identity.getByRole('button', { name: 'Edit', exact: true }).count(), 0);
    assert.equal(await identity.getByRole('button', { name: 'Edit fields', exact: true }).count(), 0);
    assert.equal(await identity.getByRole('button', { name: 'Edit background', exact: true }).count(), 0);
    assert.deepEqual(await identity.locator('.identity-module__fields dt').allTextContents(), ['Role', 'Location']);
    assert.deepEqual(await identity.locator('.identity-module__fields li').allTextContents(), ['Artist', 'Writer']);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await identity.locator('.identity-module__fields').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `.browser-test-runtime/identity-visitor-fields-${width}.png` });
    }
    await identity.getByRole('button', { name: 'Collapse INSCAPE details' }).click();
    let previousTheme = null;
    for (const theme of ['carbon', 'paper']) {
      await page.evaluate(theme => window.__renderIdentityTheme(theme), theme);
      await page.waitForTimeout(250);
      const appearance = await page.locator('.identity-module__clouds').evaluate(node => ({
        background: getComputedStyle(node).backgroundColor, ink: getComputedStyle(node).color,
      }));
      if (previousTheme) assert.notDeepEqual(appearance, previousTheme);
      previousTheme = appearance;
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(150);
        await page.screenshot({ path: `.browser-test-runtime/identity-${theme}-verified-${width}.png` });
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.getByLabel('Move Identity window', { exact: true }).focus();
    const before = await identity.boundingBox(); await page.keyboard.press('ArrowRight');
    assert.ok((await identity.boundingBox()).x > before.x);
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    await identity.waitFor();
    await page.setViewportSize({ width: 390, height: 560 });
    await page.waitForTimeout(250);
    const box = await identity.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 390);
    await page.getByRole('button', { name: 'Close Identity', exact: true }).click();
    await identity.waitFor({ state: 'detached' });
  } finally { await browser.close(); }
});

test('Identity background previews cancel cleanly; saved fields reorder and survive reopening', async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(`${origin}/development/owner/system-workflow`);
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.locator('[data-identity-dossier-source]').click();
    await page.evaluate(() => { window.__identityWrites = 0; addEventListener('inscape:review-storage-write', () => window.__identityWrites++); });
    const identity = page.locator('.identity-module');
    await identity.getByRole('button', { name: 'Expand INSCAPE details' }).click();
    const appearance = identity.getByRole('region', { name: 'Identity background', exact: true });
    await appearance.getByRole('button', { name: 'Edit background' }).click();
    await appearance.getByLabel('Background style').selectOption('clouds');
    await identity.locator('.identity-module__clouds[data-shader="ready"]').waitFor();
    assert.equal(await page.evaluate(() => window.__identityWrites), 0);
    await appearance.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await identity.locator('.identity-module__clouds').count(), 0);
    await appearance.getByRole('button', { name: 'Edit background' }).click();
    await appearance.getByLabel('Background style').selectOption('clouds');
    await appearance.getByLabel('Use theme cloud color').uncheck();
    await appearance.getByLabel('Cloud color', { exact: true }).evaluate(input => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '#7733cc');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await appearance.getByRole('slider', { name: 'Cloud movement speed' }).focus();
    await page.keyboard.press('Home');
    await page.screenshot({ path: '.browser-test-runtime/identity-background-editor.png' });
    await appearance.getByRole('button', { name: 'Save card', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__identityWrites), 1);
    const cloud = identity.locator('.identity-module__clouds[data-shader="ready"]');
    await cloud.scrollIntoViewIfNeeded(); await page.waitForTimeout(150);
    const still = await cloud.screenshot(); await page.waitForTimeout(150);
    assert.deepEqual(await cloud.screenshot(), still, 'speed zero stops animation');
    const fields = identity.getByRole('region', { name: 'Identity fields', exact: true });
    await fields.getByRole('button', { name: 'Edit fields' }).click();
    await fields.getByRole('button', { name: 'Add field', exact: true }).click();
    let rows = fields.locator('fieldset');
    await rows.nth(0).getByLabel('Field name').fill('Location');
    await rows.nth(0).getByLabel('Content', { exact: true }).fill('The Underneath\nLunar Desert');
    await fields.getByRole('button', { name: 'Add field', exact: true }).click();
    await rows.nth(1).getByLabel('Field name').fill('Role');
    await rows.nth(1).getByLabel('Content type').selectOption('list');
    await rows.nth(1).getByLabel('One item per line').fill('Artist\nWriter');
    await fields.getByRole('button', { name: 'Move field 2 up' }).click();
    assert.equal(await rows.nth(0).getByLabel('Field name').inputValue(), 'Role');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await rows.nth(0).scrollIntoViewIfNeeded();
      await page.screenshot({ path: `.browser-test-runtime/identity-field-editor-${width}.png` });
    }
    await fields.getByRole('button', { name: 'Add field', exact: true }).click();
    await fields.getByRole('button', { name: 'Save card', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__identityWrites), 2);
    assert.deepEqual(await fields.locator('dt').allTextContents(), ['Role', 'Location']);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await fields.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `.browser-test-runtime/identity-fields-${width}.png` });
      assert.equal(await identity.locator('.system-workflow__instrument-content').evaluate(n => n.scrollWidth <= n.clientWidth + 1), true);
    }
    await fields.getByRole('button', { name: 'Edit fields' }).click();
    await fields.getByRole('button', { name: 'Remove field 3' }).click();
    await fields.getByRole('button', { name: 'Save card', exact: true }).click();
    await identity.getByRole('button', { name: 'Close Identity', exact: true }).click();
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.locator('[data-identity-dossier-source]').click();
    await identity.getByRole('button', { name: 'Expand INSCAPE details' }).click();
    assert.deepEqual(await fields.locator('dt').allTextContents(), ['Role', 'Location']);
    await appearance.getByRole('button', { name: 'Edit background' }).click();
    assert.equal(await appearance.getByLabel('Background style').inputValue(), 'clouds');
    assert.equal(await appearance.getByLabel('Cloud color', { exact: true }).inputValue(), '#7733cc');
    assert.equal(await appearance.getByRole('slider', { name: 'Cloud movement speed' }).inputValue(), '0');
    await appearance.getByLabel('Background style').selectOption('plain');
    await appearance.getByRole('button', { name: 'Save card', exact: true }).click();
    assert.equal(await identity.locator('.identity-module__clouds').count(), 0);
    assert.equal(await page.evaluate(() => window.__identityWrites), 4);
  } finally { await browser.close(); }
});
