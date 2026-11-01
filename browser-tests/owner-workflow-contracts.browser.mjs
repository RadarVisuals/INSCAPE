import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5173';
const executablePath = process.env.INSCAPE_BROWSER_EXECUTABLE;
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

for (const width of [1440, 390]) test(`Library retains its live state while hidden controls cannot receive focus (${width}px)`, { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await mountTextToolsFixture(page, origin);
    const before = await page.evaluate(() => window.savedDraft());
    const trigger = page.getByRole('button', { name: 'Artwork library', exact: true });
    await trigger.click();
    const library = page.getByRole('region', { name: 'Library workspace' });
    const search = library.getByRole('searchbox', { name: 'Search', exact: true });
    await search.fill('ABYSSAL');
    assert.ok(await library.locator('.lattice-browser-asset').count() > 0);
    await search.evaluate(node => { window.retainedLibrarySearch = node; });
    await library.getByRole('button', { name: 'Close workspace' }).click();
    await library.waitFor({ state: 'hidden' }); await settle(page);
    assert.equal(await page.getByRole('searchbox', { name: 'Search', exact: true }).count(), 0,
      'closed Library controls leave the accessibility tree');
    assert.equal(await page.evaluate(() => {
      const search = window.retainedLibrarySearch;
      search.focus();
      return search.isConnected && document.activeElement !== search;
    }), true, 'the retained field stays mounted but cannot take keyboard focus');
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
    await trigger.click(); await library.waitFor();
    assert.equal(await search.evaluate(node => node === window.retainedLibrarySearch), true, 'reopening retains the same live input');
    assert.equal(await search.inputValue(), 'ABYSSAL');
    await library.getByRole('button', { name: /^Filters:/ }).click();
    const filters = page.getByRole('dialog', { name: 'Filters', exact: true });
    await filters.waitFor();
    for (const viewportWidth of [width, width === 1440 ? 390 : 1440]) {
      await page.setViewportSize({ width: viewportWidth, height: 1000 }); await settle(page);
      const bounds = await filters.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewportWidth + .5 && bounds.y + bounds.height <= 1000.5,
        'the open collection filter remains within a resized viewport');
      assert.equal(await filters.locator('.system-workflow__filter-options').evaluate(node => getComputedStyle(node).overflowY), 'auto');
    }
    await page.keyboard.press('Escape'); await filters.waitFor({ state: 'hidden' });
    await library.getByRole('button', { name: 'Close workspace' }).click(); await library.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    const publication = page.getByRole('complementary', { name: 'Publish profile' }); await publication.waitFor();
    assert.equal(await page.locator('main.system-workflow').evaluate(node => node.inert), false, 'Publish keeps the workspace interactive');
    await page.getByRole('button', { name: 'Library', exact: true }).click(); await library.waitFor(); await publication.waitFor({ state: 'hidden' });
    assert.deepEqual(await page.evaluate(() => window.savedDraft()), before, 'browsing never writes the composition');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('workflow typography resolves its semantic scale in the rendered cascade', { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await mountTextToolsFixture(page, origin);
    const contracts = [
      ['display', 600, 28, 1.08, 'Inscape Sora'], ['title', 600, 18, 1.15, 'Inscape Sora'],
      ['section', 600, 15, 1.2, 'Inscape Sora'], ['body', 400, 14, 1.5, 'Inscape Sora'],
      ['control', 400, 11, 1.2, 'Inscape Sora'], ['sidebar', 450, 11, 1.1, 'Inscape Sora'],
      ['label', 500, 10, 1.25, 'Inscape IBM Plex Sans Condensed'],
      ['micro', 400, 10, 1.35, 'Inscape IBM Plex Sans Condensed'],
      ['technical', 400, 10, 1.35, 'Inscape IBM Plex Sans Condensed'],
    ];
    const measured = await page.locator('main.system-workflow').evaluate((root, contracts) => contracts.map(([name]) => {
      const probe = document.createElement('span'); probe.textContent = 'Measured type';
      probe.style.font = `var(--workflow-type-${name})`; root.append(probe);
      const style = getComputedStyle(probe), value = { name, weight: Number(style.fontWeight), size: parseFloat(style.fontSize), line: parseFloat(style.lineHeight), family: style.fontFamily };
      probe.remove(); return value;
    }), contracts);
    for (const [index, [name, weight, size, line, family]] of contracts.entries()) {
      const actual = measured[index];
      assert.deepEqual([actual.name, actual.weight, actual.size], [name, weight, size]);
      assert.ok(Math.abs(actual.line - size * line) < .02, `${name}: resolved line height`);
      assert.ok(actual.family.includes(family), `${name}: font family`);
    }
    assert.match(await page.locator('main.system-workflow').evaluate(node => getComputedStyle(node).fontFamily), /Inscape Sora/);
    assert.equal(await page.locator('.system-workflow__canvas').evaluate(node => getComputedStyle(node).boxShadow), 'none');
    const presentation = await page.locator('main.system-workflow').evaluate(root => {
      const fixture = document.createElement('div');
      fixture.innerHTML = '<div class="system-workflow__select-popover"><code>Technical value</code></div><div class="system-workflow__filter-popover"><output>Technical value</output></div><div class="system-workflow__settings"><svg class="lucide"></svg></div><div data-panel-phase="closing"><div><div class="system-workflow__motion-panel">Nested closing panel</div></div></div>';
      root.append(fixture);
      const scope = getComputedStyle(root), popovers = [...fixture.querySelectorAll('.system-workflow__select-popover, .system-workflow__filter-popover')];
      const result = {
        border: scope.getPropertyValue('--workflow-border').trim(), strong: scope.getPropertyValue('--workflow-border-strong').trim(),
        fonts: popovers.map(node => [getComputedStyle(node).fontFamily, getComputedStyle(node.firstElementChild).fontFamily]),
        stroke: getComputedStyle(fixture.querySelector('svg')).strokeWidth,
        closingOpacity: getComputedStyle(fixture.querySelector('.system-workflow__motion-panel')).opacity,
      };
      fixture.remove(); return result;
    });
    assert.equal(presentation.strong, presentation.border, 'strong border resolves the shared border');
    for (const [body, technical] of presentation.fonts) {
      assert.match(body, /Inscape Sora/); assert.match(technical, /Inscape IBM Plex Sans Condensed/);
    }
    assert.equal(presentation.stroke, '1.75px');
    assert.equal(presentation.closingOpacity, '0', 'closing styles reach a nested motion panel');
  } finally { await browser.close(); }
});

test('Discover distinguishes an empty directory, no search match and a retryable failure', { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route(`${origin}/__discovery_contract__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__discovery_contract__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
      const Portal = (await import('/src/startveil/PublicEntryPortal.jsx')).default;
      await import('/src/index.css'); await import('/src/inscapeTokens.css');
      const root = createRoot(document.getElementById('root'));
      window.discoveryCloseCount = 0;
      window.renderDiscovery = failed => root.render(React.createElement(Portal, { embedded: true, initialMode: 'explore', onClose: () => window.discoveryCloseCount++, discoveryRepository: { list: async () => { if (failed) throw Error('Review unavailable'); return []; } } }));
      window.renderDiscovery(false);
    });
    const portal = page.locator('.public-entry-portal');
    await portal.getByText('No worlds found', { exact: true }).waitFor();
    assert.equal(await portal.getByText('No published worlds are available yet.', { exact: true }).count(), 1);
    await portal.getByRole('searchbox', { name: 'Search published worlds', exact: true }).fill('missing world');
    await portal.getByText('Try another name or profile address.', { exact: true }).waitFor();
    assert.equal(await portal.getByText('No published worlds are available yet.', { exact: true }).count(), 0);
    await page.evaluate(() => window.renderDiscovery(true));
    await portal.getByText('Public directory unavailable', { exact: true }).waitFor();
    await portal.getByText('You can retry without connecting a profile.', { exact: true }).waitFor();
    assert.equal(await portal.getByText('Try another name or profile address.', { exact: true }).count(), 0);
    await portal.getByRole('button', { name: 'Return to workspace', exact: true }).click();
    assert.equal(await page.evaluate(() => window.discoveryCloseCount), 1);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
