import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5180';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const near = (a, b, label) => assert.ok(Math.abs(a - b) < 1.1, `${label}: ${a} vs ${b}`);

for (const [width, density] of [[1440, 1], [390, 1.25]]) test(`every resize grip can be grabbed at its actual corner or midpoint at ${width}px`, { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: density, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route(`${origin}/__resize_handles__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__resize_handles__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      (await import('/browser-tests/workbench-resize-handles-fixture.jsx')).mount();
    });
    await page.locator('.image-module__window').waitFor();
    const show = async (kind, scale, extra) => { await page.evaluate(([kind, scale, extra]) => resizeFixture.show(kind, scale, extra), [kind, scale, extra]); await settle(page); };
    for (const kind of ['Image', 'Shape', 'Text', 'Display']) for (const scale of [.25, .55, 1]) {
      await show(kind, scale);
      const surface = page.locator(kind === 'Display' ? '.system-workflow__presentation-board' : '[data-workbench-view-id="sample"]');
      const handles = surface.locator(kind === 'Display' ? '.system-workflow__board-resize-handle' : '[role="separator"]');
      const edges = await handles.evaluateAll(nodes => nodes.map(node => [...node.classList].find(name => name.startsWith('is-')).slice(3)));
      for (const edge of edges) {
        await show(kind, scale);
        const handle = handles.and(page.locator(`.is-${edge}`));
        const before = await surface.boundingBox();
        const x = edge.includes('w') ? before.x : edge.includes('e') ? before.x + before.width : before.x + before.width / 2;
        const y = edge.includes('n') ? before.y : edge.includes('s') ? before.y + before.height : before.y + before.height / 2;
        // Check the visible point and its surrounding pixels, not the centre
        // of a potentially misplaced DOM target (which hid the original bug).
        for (const [dx, dy] of [[0, 0], [-6, -6], [6, -6], [-6, 6], [6, 6]]) {
          const hit = await handle.evaluate((node, p) => ({ matches: node.contains(document.elementFromPoint(p.x, p.y)), target: document.elementFromPoint(p.x, p.y)?.className, box: node.getBoundingClientRect().toJSON() }), { x: x + dx, y: y + dy });
          assert.ok(hit.matches, `${kind} ${scale} ${edge}: visible grip misses at ${dx},${dy}: ${JSON.stringify(hit)}; surface ${JSON.stringify(before)}`);
        }
        await page.mouse.move(x, y); await page.mouse.down();
        const dx = edge.includes('w') ? -12 : edge.includes('e') ? 12 : 0;
        const dy = edge.includes('n') ? -12 : edge.includes('s') ? 12 : 0;
        await page.mouse.move(x + dx, y + dy, { steps: 4 }); await page.mouse.up(); await settle(page);
        const after = await surface.boundingBox();
        if (kind !== 'Display') {
          near(after.width, before.width + Math.abs(dx), `${kind} ${scale} ${edge} width`);
          near(after.height, before.height + Math.abs(dy), `${kind} ${scale} ${edge} height`);
        } else assert.ok(after.width > before.width && after.height > before.height, 'Display resizes proportionally');
        near(edge.includes('w') ? after.x + after.width : after.x, edge.includes('w') ? before.x + before.width : before.x, 'opposite horizontal edge');
        near(edge.includes('n') ? after.y + after.height : after.y, edge.includes('n') ? before.y + before.height : before.y, 'opposite vertical edge');
        assert.equal(await handle.evaluate(node => getComputedStyle(node).outlineStyle), 'none', `${kind}: pointer resize exposes no hit-zone outline`);
      }
      await handles.last().focus(); await page.keyboard.press('ArrowRight'); await settle(page);
      assert.equal(await handles.last().evaluate(node => getComputedStyle(node).outlineStyle), 'none');
      await page.screenshot({ path: `.browser-test-runtime/handles-${kind}-${width}-${scale}.png` });
    }
    // Group handles already centre on the selection bounds; exercise all four.
    for (const edge of ['nw', 'ne', 'sw', 'se']) {
      await show('Shape', .55); await page.evaluate(() => resizeFixture.select()); await settle(page);
      const selection = page.locator('.workbench-selection'), grip = selection.locator(`.is-${edge}`);
      const b = await selection.boundingBox(), x = edge.includes('w') ? b.x : b.x + b.width, y = edge.includes('n') ? b.y : b.y + b.height;
      assert.ok(await grip.evaluate((node, p) => node.contains(document.elementFromPoint(p.x, p.y)), { x, y }));
      await grip.focus(); await page.keyboard.press('ArrowRight'); await settle(page);
      assert.equal(await grip.evaluate(node => getComputedStyle(node).outlineStyle), 'none', 'group keyboard focus never outlines the large click zone');
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 15, y + 15); await page.keyboard.press('Escape'); await page.mouse.up(); await settle(page);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
