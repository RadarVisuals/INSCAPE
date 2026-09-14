import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { createAddressQrImage } from '../src/public/identity/addressQr.js';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5174';
test('expansion preserves the cloud program, clock and top-anchored pattern', async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.addInitScript(() => {
      const proto = WebGLRenderingContext.prototype, names = new WeakMap(), clocks = new WeakMap();
      const location = proto.getUniformLocation, uniform = proto.uniform1f, draw = proto.drawArrays, create = proto.createProgram;
      window.__identityPrograms = 0;
      proto.createProgram = function(...args) { if (this.canvas.classList.contains('identity-module__clouds')) window.__identityPrograms++; return create.apply(this, args); };
      proto.getUniformLocation = function(program, name) { const result = location.call(this, program, name); if (result) names.set(result, name); return result; };
      proto.uniform1f = function(loc, value) { if (names.get(loc) === 'time') clocks.set(this, value); return uniform.call(this, loc, value); };
      proto.drawArrays = function(...args) {
        const result = draw.apply(this, args);
        if (this.canvas.classList.contains('identity-module__clouds')) {
          const samples = [];
          for (const x of [.2, .5, .8]) for (const y of [.1, .2, .3]) {
            const pixel = new Uint8Array(4);
            this.readPixels(Math.floor(this.canvas.width * x), this.canvas.height - 1 - Math.floor(this.canvas.width * y), 1, 1, this.RGBA, this.UNSIGNED_BYTE, pixel);
            samples.push(...pixel.slice(0, 3));
          }
          window.__identityCloud = { time: clocks.get(this), samples };
        }
        return result;
      };
    });
    await page.goto(`${origin}/development/owner/system-workflow`);
    await page.locator('.system-workflow').waitFor();
    await page.evaluate(async () => {
      const React = (await import('/@id/react')).default;
      const { createRoot } = (await import('/@id/react-dom/client')).default;
      const Identity = (await import('/src/public/identity/IdentityModule.jsx')).default;
      const node = document.createElement('div'); document.querySelector('.system-workflow').append(node);
      const root = createRoot(node);
      root.render(React.createElement(Identity, { menuSurface: 'carbon', onClose: () => root.unmount(), model: {
        address: '0x1111111111111111111111111111111111111111',
        profile: { displayName: 'Continuity', tags: [], avatarProvenance: 'INSCAPE_PUBLISHED_ASSET', avatarUrl: '/assets/actors/skull_reaper/full.webp' },
        card: { version: 1, columns: 5, background: { type: 'clouds', color: null, speed: 1 }, fields: [
          { id: 'field:role', label: 'Role', type: 'text', value: 'Artist' },
          { id: 'field:projects', label: 'Projects', type: 'list', value: ['Inscape', 'Human Underneath', 'Illustration', 'Sound'] },
          { id: 'field:location', label: 'Currently in', type: 'text', value: 'The Underneath' },
          { id: 'field:aesthetic', label: 'Aesthetic', type: 'list', value: ['Biomechanical', 'Osteological'] },
          { id: 'field:exploring', label: 'Exploring', type: 'list', value: ['Dynamic & Expressive Visual Systems', 'Reactivity & Interactivity', 'Motion through code'] },
        ] }, links: [],
      } }));
    });
    await page.waitForFunction(() => window.__identityCloud?.time > .1);
    // Lazy module loading can place the legacy shell stylesheet after bevel chrome.
    await page.evaluate(async () => {
      const style = document.createElement('style');
      style.textContent = (await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css?raw')).default;
      document.head.append(style);
    });
    const assertCardEdges = async () => {
      const edges = await page.locator('.identity-module > aside').evaluate(window => {
        const surface = window.querySelector('.system-workflow__instrument-content');
        const box = window.getBoundingClientRect(), body = surface.getBoundingClientRect();
        return { gutter: getComputedStyle(window).getPropertyValue('--detached-window-gutter').trim(),
          left: body.left - box.left, right: box.right - body.right, bottom: box.bottom - body.bottom };
      });
      assert.equal(edges.gutter, '1px', 'bevel gutter survives legacy stylesheet loading later');
      for (const side of ['left', 'right', 'bottom']) assert.ok(Math.abs(edges[side] - 2) < 1, `${side} is only the border plus 1px gutter: ${edges[side]}`);
    };
    await assertCardEdges();
    assert.equal(await page.locator('.identity-module__clouds').count(), 1, 'one cloud renderer covers body and title bar');
    const cloudBounds = await page.locator('.identity-module__clouds').boundingBox();
    const titleBounds = await page.locator('.identity-module > aside > header').boundingBox();
    assert.ok(cloudBounds.y <= titleBounds.y && cloudBounds.y + cloudBounds.height > titleBounds.y + titleBounds.height, 'clouds extend behind the title bar');
    const before = await page.evaluate(() => ({ ...window.__identityCloud, programs: window.__identityPrograms }));
    await page.getByRole('button', { name: 'Expand INSCAPE details' }).click();
    await page.waitForTimeout(150);
    assert.ok(await page.evaluate(() => window.__identityCloud.time) >= before.time, 'animation clock is not reset');
    assert.equal(await page.evaluate(() => window.__identityPrograms), before.programs, 'program not recreated');
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(100);
    const expanded = await page.evaluate(() => window.__identityCloud);
    await page.getByRole('button', { name: 'Collapse INSCAPE details' }).click(); await page.waitForTimeout(100);
    const compact = await page.evaluate(() => window.__identityCloud);
    assert.equal(compact.time, expanded.time);
    const differences = compact.samples.map((value, index) => Math.abs(value - expanded.samples[index]));
    assert.ok(Math.max(...differences) < 20, `pattern remains anchored; sampling differences: ${differences}`);
    await page.getByRole('button', { name: 'Expand INSCAPE details' }).click(); await page.waitForTimeout(100);
    assert.equal(await page.locator('.identity-module__fields dd').last().isVisible(), true);
    const rows = await page.locator('.identity-module__cell').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top));
    assert.ok(rows.every(top => Math.abs(top - rows[0]) < 1), 'five normal sections share one row on a wide card');
    await page.screenshot({ path: '.browser-test-runtime/identity-five-columns.png' });
    await assertCardEdges();
    assert.equal(await page.getByRole('separator', { name: 'Resize Identity height' }).count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(150);
    await assertCardEdges();
    await page.screenshot({ path: '.browser-test-runtime/identity-gutter-narrow.png' });
  } finally { await browser.close(); }
});
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
    assert.equal(await page.evaluate(() => window.__identityWrites), 0, 'dropping artwork only previews it');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__identityWrites), 1);
    const canvas = page.locator('.identity-module__clouds[data-shader="ready"]');
    await canvas.waitFor();
    // The canvas now also sits behind header controls. Keep hover transitions
    // and delayed tooltips out of the shader's screenshot comparison.
    await page.mouse.move(0, 0);
    await page.waitForTimeout(250);
    // Compare the shader itself, not text/caret/hover painting above its canvas.
    const isolateShader = await page.addStyleTag({ content: '.identity-module > aside > :not(.identity-module__clouds) { visibility: hidden !important; }' });
    const first = await canvas.screenshot(); await page.waitForTimeout(250);
    assert.equal((await canvas.screenshot()).equals(first), false, 'cloud pixels animate');
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(200);
    const still = await canvas.screenshot(); await page.waitForTimeout(200);
    assert.equal((await canvas.screenshot()).equals(still), true, 'reduced motion stays still');
    await isolateShader.evaluate(node => node.remove());
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
    assert.equal(await page.locator('[data-identity-dossier-source] img').count(), 0, 'custom artwork must not replace the account avatar');
    await page.locator('[data-identity-dossier-source]').click();
    assert.match(await page.locator('.identity-module__portrait img').getAttribute('src'), /skull_reaper/);
    await page.getByRole('button', { name: 'Edit Identity', exact: true }).click();
    await page.getByText('Appearance & artwork', { exact: true }).click();
    await page.getByRole('button', { name: 'Use Universal Profile image' }).click();
    assert.equal(await page.locator('.identity-module__portrait img').count(), 0);
    assert.equal(await page.evaluate(() => window.__identityWrites), 1, 'reset is also a preview');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.match(await page.locator('.identity-module__portrait img').getAttribute('src'), /skull_reaper/);
    await page.getByRole('button', { name: 'Edit Identity', exact: true }).click();
    await page.getByText('Appearance & artwork', { exact: true }).click();
    await page.getByRole('button', { name: 'Use Universal Profile image' }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
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
    assert.equal(chrome.radius, '10px'); assert.match(chrome.grain, /grain-mono/); assert.equal(chrome.control, '26px');
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
    const icons = await identity.evaluate(node => ['.identity-module__source-link svg', '.identity-module__address-control svg', '.identity-module__title > .identity-module__header-action svg'].map(selector => {
      const style = getComputedStyle(node.querySelector(selector)); return [style.color, style.strokeWidth, style.marginLeft];
    }));
    assert.deepEqual(icons[0], icons[1]);
    assert.deepEqual(icons[0], icons[2]);
    await identity.getByRole('button', { name: 'Show address QR code' }).click();
    const qr = page.getByRole('dialog', { name: 'Share profile address' });
    await qr.locator('img').waitFor();
    assert.equal(await qr.locator('img').getAttribute('src'), createAddressQrImage('0x1111111111111111111111111111111111111111'));
    assert.equal(await qr.locator('code').textContent(), '0x1111111111111111111111111111111111111111');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForFunction(() => {
        const anchor = document.querySelector('[aria-label="Show address QR code"]').getBoundingClientRect();
        const popup = document.querySelector('.identity-module__qr').getBoundingClientRect();
        return Math.abs(popup.top - anchor.bottom - 8) < 1
          && Math.abs(popup.left - Math.max(16, Math.min(anchor.left, innerWidth - popup.width - 16))) < 1;
      });
      const bounds = await qr.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
      await page.screenshot({ path: `.browser-test-runtime/identity-qr-${width}.png` });
      await qr.locator('img').screenshot({ path: `.browser-test-runtime/identity-qr-code-${width}.png` });
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

test('Identity edits in place, exposes all cells with one click, and fits content without manual resizing', async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await page.goto(`${origin}/development/owner/system-workflow`);
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    await page.locator('[data-identity-dossier-source]').click();
    const identity = page.locator('.identity-module aside');
    const officialName = await identity.locator('.identity-module__story h2').innerText();
    assert.equal(await identity.getByRole('separator').count(), 0);
    await page.evaluate(() => { window.__identityWrites = 0; addEventListener('inscape:review-storage-write', () => window.__identityWrites++); });
    await identity.getByRole('button', { name: 'Edit Identity', exact: true }).click();
    const hero = identity.locator('.identity-module__story');
    assert.equal(await identity.getByRole('button', { name: 'Edit Identity', exact: true }).evaluate(n => getComputedStyle(n).transform), 'matrix(1, 0, 0, 1, 0, 1)');
    await hero.getByLabel('Custom title', { exact: true }).fill('Human Underneath');
    assert.equal(await hero.getByLabel('Subtitle', { exact: true }).count(), 0);
    await hero.getByLabel('Custom bio', { exact: true }).fill('My illustrated world.');
    await hero.getByLabel('Tags, separated by commas').fill('Illustration, Sound');
    await identity.getByRole('button', { name: 'Add field', exact: true }).click();
    await identity.getByLabel('Field 1 name', { exact: true }).fill('Role');
    await identity.getByLabel('Field 1 content type', { exact: true }).selectOption('list');
    await identity.getByLabel('Field 1 content', { exact: true }).fill('Artist\nWriter');
    await identity.getByRole('button', { name: 'Add field', exact: true }).click();
    await identity.getByLabel('Field 2 name', { exact: true }).fill('Location');
    await identity.getByLabel('Field 2 content', { exact: true }).fill('The Underneath');
    await identity.getByRole('button', { name: 'Move field 2 up' }).click();
    assert.equal(await identity.getByLabel('Field 1 name', { exact: true }).inputValue(), 'Location');
    assert.equal(await identity.getByLabel('Field 1 name', { exact: true }).evaluate(n => n === document.activeElement), true);
    assert.equal(await identity.locator('[data-moved="true"] input').first().inputValue(), 'Location');
    assert.equal(await identity.getByRole('status').textContent(), 'Location moved to position 1');
    await identity.getByLabel('Detail columns', { exact: true }).selectOption('5');
    await identity.getByLabel('Field 2 wide', { exact: true }).check();
    await identity.getByText('Appearance & artwork', { exact: true }).click();
    await identity.getByLabel('Background style').selectOption('clouds');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 }); await page.waitForTimeout(200);
      await identity.getByRole('button', { name: 'Save', exact: true }).hover();
      assert.equal(await identity.locator('textarea').evaluateAll(nodes => nodes.every(n => n.scrollHeight <= n.clientHeight)), true, 'short editor content fits without scrollbars after resizing');
      const headerTop = (await identity.locator('.system-workflow__detached-window-titlebar').boundingBox()).y;
      for (const name of ['Save', 'Cancel']) {
        assert.equal((await identity.getByRole('button', { name, exact: true }).boundingBox()).y, headerTop);
      }
      await page.screenshot({ path: `.browser-test-runtime/identity-inline-edit-${width}.png` });
      assert.equal(await identity.locator('.system-workflow__instrument-content').evaluate(n => n.scrollWidth <= n.clientWidth + 1), true);
    }
    await identity.getByRole('button', { name: 'Save', exact: true }).click();
    assert.equal(await hero.getByLabel('Custom title', { exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => window.__identityWrites), 1);
    assert.equal(await hero.locator('h2').innerText(), officialName);
    assert.equal(await hero.locator('.identity-module__custom-title').textContent(), 'Human Underneath');
    assert.equal(await hero.locator('.identity-module__subtitle').count(), 0);
    assert.equal(await identity.getByRole('button', { name: 'Edit Identity', exact: true }).evaluate(n => n === document.activeElement), true);
    assert.equal(await identity.locator('.identity-module__extension summary').count(), 0);
    assert.deepEqual(await identity.locator('.identity-module__fields dt').allTextContents(), ['Location', 'Role']);
    assert.deepEqual(await identity.locator('.identity-module__fields li').allTextContents(), ['Artist', 'Writer']);
    assert.equal(await identity.locator('.identity-module__fields').getAttribute('data-columns'), '5');
    assert.equal(await identity.locator('.identity-module__cell').nth(1).getAttribute('data-wide'), 'true');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 }); await page.waitForTimeout(200);
      await identity.getByRole('button', { name: 'Collapse INSCAPE details' }).click();
      await page.waitForTimeout(150);
      const gap = await identity.locator('.system-workflow__instrument-content').evaluate(n =>
        n.clientHeight - n.querySelector('.identity-module__card').getBoundingClientRect().height);
      assert.ok(gap <= 2, 'no empty bar below compact content: ' + gap);
      await page.screenshot({ path: `.browser-test-runtime/identity-inline-compact-${width}.png` });
      await identity.getByRole('button', { name: 'Expand INSCAPE details' }).click();
      assert.equal(await identity.locator('.identity-module__fields dd').first().isVisible(), true);
      assert.equal(await identity.locator('.identity-module__fields dd').last().isVisible(), true);
      const columns = await identity.locator('.identity-module__fields').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length);
      assert.equal(columns, width === 1440 ? 5 : 2, 'columns respond to card width');
      const cellWidths = await identity.locator('.identity-module__cell').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().width));
      assert.ok(Math.abs(cellWidths[1] / cellWidths[0] - 2) < .01, 'wide spans two columns when space permits');
      assert.equal(await identity.locator('.identity-module__fields').evaluate(node => node.scrollWidth <= node.clientWidth + 1), true);
      await page.screenshot({ path: `.browser-test-runtime/identity-inline-expanded-${width}.png` });
    }
    await identity.getByRole('button', { name: 'Edit Identity', exact: true }).click();
    await identity.getByRole('button', { name: 'Remove field 2' }).click();
    await hero.getByLabel('Custom title', { exact: true }).fill('Discarded');
    await identity.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await identity.locator('.identity-module__fields dd').count(), 2);
    assert.equal(await hero.locator('.identity-module__custom-title').textContent(), 'Human Underneath');
    assert.equal(await page.evaluate(() => window.__identityWrites), 1);
    await identity.getByRole('button', { name: 'Close Identity', exact: true }).click();
    await page.getByRole('button', { name: 'Profile', exact: true }).click();
    assert.equal(await page.locator('[data-identity-dossier-source] b').innerText(), officialName, 'custom title must not replace the account name');
    await page.screenshot({ path: '.browser-test-runtime/identity-dock-official.png' });
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
        profile: { displayName: 'Identity test', description: 'Existing biography', tags: [], avatarProvenance: 'INSCAPE_PUBLISHED_ASSET', avatarUrl: '/assets/actors/skull_reaper/full.webp' },
        authoredProfile: { title: 'Human Underneath', description: 'An illustrated world, built from art, motion and sound.', tags: ['Illustration', 'Sound'] },
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
    assert.match(await identity.innerText(), /An illustrated world/);
    const links = identity.getByRole('navigation', { name: 'Profile links' });
    assert.equal(await links.getByRole('link', { name: 'Artist on X', exact: true }).getAttribute('title'), 'Artist on X');
    const github = links.getByRole('link', { name: 'Source code', exact: true });
    assert.equal(await github.locator('svg.lucide-github').count(), 1);
    assert.equal(await github.locator('span').count(), 0);
    await github.focus();
    assert.equal(await github.getAttribute('title'), 'Source code');
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
    for (const theme of ['carbon', 'ash', 'mist', 'paper']) {
      await page.evaluate(theme => window.__renderIdentityTheme(theme), theme);
      await page.waitForTimeout(250);
      const appearance = await page.locator('.identity-module__clouds').evaluate(node => ({
        background: getComputedStyle(node).backgroundColor, ink: getComputedStyle(node).color,
      }));
      if (previousTheme) assert.notDeepEqual(appearance, previousTheme);
      previousTheme = appearance;
      const chrome = await identity.evaluate(node => {
        const style = getComputedStyle(node);
        const cap = getComputedStyle(node.querySelector('[aria-label="Close Identity"]'));
        return { border: style.borderTopWidth, gutter: style.getPropertyValue('--detached-window-gutter').trim(),
          contentBorder: getComputedStyle(node.querySelector('.system-workflow__instrument-content')).borderTopWidth,
          header: getComputedStyle(node.querySelector('header')).backgroundColor,
          extension: getComputedStyle(node.querySelector('.identity-module__extension')).backgroundColor,
          capWidth: cap.width, capBorder: cap.borderTopWidth, capRadius: cap.borderRadius };
      });
      assert.equal(chrome.border, '1px');
      assert.equal(chrome.gutter, '1px');
      assert.equal(chrome.contentBorder, '0px');
      assert.equal(chrome.header, chrome.extension, 'header and details share the same translucent surface');
      assert.equal(chrome.capWidth, '26px');
      assert.equal(chrome.capBorder, '0px');
      assert.equal(chrome.capRadius, '50%');
      await identity.getByRole('button', { name: 'Close Identity', exact: true }).focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      assert.equal(await identity.getByRole('button', { name: 'Close Identity', exact: true }).evaluate(n => getComputedStyle(n).outlineWidth), '1px');
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
