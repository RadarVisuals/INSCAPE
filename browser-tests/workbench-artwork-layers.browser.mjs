import { separateLayers } from './fixtures/shared-tools.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:24970';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/workbench-artwork-layers';
const saved = page => page.evaluate(() => window.savedDraft());
const rows = page => page.locator('.workbench-layer-row').evaluateAll(nodes => nodes.map(node => node.dataset.layerId));
const undo = async page => { await page.locator('.system-workflow').focus(); await page.keyboard.press('Control+z'); };
async function fixture(page, options = {}) {
  page.setDefaultTimeout(12000);
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', async route => {
    const file = new URL(route.request().url()).pathname.split('/public/')[1];
    await route.fulfill({ response: await route.fetch({ url: `${origin}/${file}` }) });
  });
  await page.goto(`${origin}/browser-tests/workbench-storage-fixture.html`);
  await page.getByRole('combobox', { name: 'Active Workbench' }).waitFor();
  await page.evaluate(async options => {
    const { layersDraft } = await import('/browser-tests/fixtures/artwork-layers.js');
    const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    const draft = layersDraft();
    if (options.selectionOnly) { draft.texts = []; draft.workbench.texts = []; draft.artworkLayers = draft.artworkLayers.filter(id => id !== 'text:mist'); }
    if (options.closed) draft.workbench.imageModules[0].open = false;
    if (options.outside) draft.workbench.imageModules[0].position.left = 2400;
    if (options.carbon) draft.appearance.menuSurfaceId = 'carbon';
    if (options.writing) draft.texts[0].article.content = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Native Text deletion' }] }] };
    if (options.many) for (let i = 0; i < 18; i++) {
      const id = `shape:extra-${i}`;
      draft.shapes.push({ ...draft.shapes[0], id, name: `Landscape study ${i + 1}` });
      draft.workbench.shapes.push({ ...draft.workbench.shapes[0], id, open: false }); draft.artworkLayers.push(id);
    }
    if (options.grouped) draft.artworkLayers = ['shape:landscape', 'text:mist', { id: 'composition:person', name: 'Person', children: ['image:body', 'image:eyes'] }];
    window.leaveEditor(); localStorage.setItem(systemWorkflowDraftKey(window.fixtureProfile), JSON.stringify(draft));
  }, options);
  await page.reload();
  await separateLayers(page);
  await page.getByRole('button', { name: options.grouped ? 'Select Person' : 'Select Eyes', exact: true }).waitFor();
  await page.locator('[data-workbench-artwork]').first().waitFor();
}
test('tool panel moves independently, distinguishes pointer/keyboard focus, cancels gestures and stays reachable', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await fixture(page, { carbon: true, many: true }); await mkdir(output, { recursive: true });
    const before = await saved(page), panel = page.getByRole('region', { name: 'Workbench Layers', exact: true });
    const grip = page.getByRole('button', { name: 'Move Layers panel', exact: true });
    const start = await panel.boundingBox();
    const drag = async (dx, dy) => {
      const box = await grip.boundingBox();
      await page.mouse.move(box.x + 50, box.y + 16); await page.mouse.down();
      await page.mouse.move(box.x + 50 + dx, box.y + 16 + dy, { steps: 5 });
    };
    await drag(48, 32); await page.mouse.up();
    const moved = await panel.boundingBox();
    assert.equal(moved.x, start.x + 48); assert.equal(moved.y, start.y + 32);
    assert.equal(await grip.evaluate(node => node.matches(':focus-visible')), false);
    assert.equal(await grip.evaluate(node => getComputedStyle(node).outlineWidth), '0px');
    await page.screenshot({ path: `${output}/layers-clean-pointer.png` });
    await drag(30, 25); await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await panel.boundingBox(), moved, 'Escape restores only the tool position');
    await drag(30, 25); await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.mouse.up();
    assert.deepEqual(await panel.boundingBox(), moved, 'loss of window focus cancels the drag');
    await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
    assert.equal(await grip.evaluate(node => document.activeElement === node && node.matches(':focus-visible')), true);
    await grip.press('Shift+ArrowRight'); await grip.press('Alt+ArrowUp');
    const keyed = await panel.boundingBox(); assert.equal(keyed.x, moved.x + 24); assert.equal(keyed.y, moved.y - 1);
    await page.screenshot({ path: `${output}/layers-clean-keyboard.png` });
    await page.setViewportSize({ width: 760, height: 500 });
    await page.waitForFunction(() => {
      const panel = document.querySelector('.workbench-tool-panel').getBoundingClientRect();
      const navigation = document.querySelector('.workbench-switcher__navigation').getBoundingClientRect();
      return panel.x >= 8 && panel.right <= innerWidth - 8 && panel.bottom <= innerHeight - 48 && panel.top >= navigation.bottom + 8;
    });
    const list = page.locator('.workbench-layers-list');
    assert.ok(await list.evaluate(node => node.scrollHeight > node.clientHeight && node.clientHeight > 0));
    await list.evaluate(node => { node.scrollTop = node.scrollHeight; });
    await page.getByRole('button', { name: 'Select Landscape', exact: true }).waitFor();
    const actions = await panel.getByRole('navigation', { name: 'Layer actions', exact: true }).boundingBox();
    const small = await panel.boundingBox(); assert.ok(actions.y + actions.height <= small.y + small.height);
    await page.screenshot({ path: `${output}/layers-clean-760-short.png` });
    await page.getByRole('button', { name: 'Close Workbench Layers' }).click();
    const toggle = page.locator('[data-workbench-toolbar]').getByRole('button', { name: 'Layers', exact: true });
    assert.equal(await toggle.evaluate(node => document.activeElement === node), true);
    await toggle.click(); await grip.waitFor();
    assert.deepEqual(await saved(page), before, 'panel interaction never writes artwork or presentation');
    await drag(10, 10); await page.evaluate(() => window.leaveEditor()); await page.mouse.up();
    assert.deepEqual(errors, [], 'closing the editor disposes an active panel gesture');
  } finally { await browser.close(); }
});

test('invisible panel edges resize from every side without changing artwork; minimums, cancellation and viewport bounds hold', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await fixture(page, { carbon: true, many: true }); await mkdir(output, { recursive: true });
    const before = await saved(page), panel = page.getByRole('region', { name: 'Workbench Layers', exact: true });
    const start = await panel.boundingBox();
    const drag = async (edge, dx, dy) => {
      const box = await panel.locator(`[data-edge="${edge}"]`).boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 5 });
    };
    for (const edge of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
      const handle = panel.locator(`[data-edge="${edge}"]`);
      await handle.hover();
      const style = await handle.evaluate(node => {
        const style = getComputedStyle(node);
        return { fill: style.backgroundColor, border: style.borderWidth, shadow: style.boxShadow, cursor: style.cursor };
      });
      assert.equal(style.fill, 'rgba(0, 0, 0, 0)'); assert.equal(style.border, '0px'); assert.equal(style.shadow, 'none');
      assert.equal(style.cursor, edge.length === 2 ? ['nw', 'se'].includes(edge) ? 'nwse-resize' : 'nesw-resize' : ['n', 's'].includes(edge) ? 'ns-resize' : 'ew-resize');
      await drag(edge, 16, 12); await page.mouse.up();
      const resized = await panel.boundingBox();
      assert.equal(resized.x, start.x + (edge.includes('w') ? 16 : 0));
      assert.equal(resized.y, start.y + (edge.includes('n') ? 12 : 0));
      assert.equal(resized.width, start.width + (edge.includes('w') ? -16 : edge.includes('e') ? 16 : 0));
      assert.equal(resized.height, start.height + (edge.includes('n') ? -12 : edge.includes('s') ? 12 : 0));
      assert.equal(await handle.evaluate(node => node.matches(':focus-visible')), false);
      await drag(edge, -16, -12); await page.mouse.up();
      assert.deepEqual(await panel.boundingBox(), start);
    }
    await drag('se', -100, -300); await page.mouse.up();
    const compact = await panel.boundingBox(); assert.equal(compact.width, 280); assert.equal(compact.height, 240);
    const list = page.locator('.workbench-layers-list');
    assert.ok(await list.evaluate(node => node.clientHeight > 0 && node.scrollHeight > node.clientHeight));
    await page.screenshot({ path: `${output}/layers-resized-carbon-1440.png` });
    await drag('nw', -30, -20); await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await panel.boundingBox(), compact);
    await drag('se', 40, 30); await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.mouse.up();
    assert.deepEqual(await panel.boundingBox(), compact);
    const corner = panel.getByRole('button', { name: 'Resize Layers panel', exact: true });
    await corner.press('Shift+ArrowRight'); await corner.press('Alt+ArrowDown');
    const keyed = await panel.boundingBox(); assert.equal(keyed.width, 304); assert.equal(keyed.height, 241);
    await page.setViewportSize({ width: 760, height: 850 });
    await drag('se', 500, 600); await page.mouse.up();
    const bounded = await panel.boundingBox();
    const rail = await page.locator('[data-workbench-toolbar]').boundingBox();
    assert.ok(bounded.x >= 8 && bounded.x + bounded.width <= 752 && bounded.y + bounded.height < rail.y);
    await drag('se', -500, -600); await page.mouse.up();
    assert.equal(await panel.locator('.workbench-tool-panel-resize:focus-visible').count(), 0, 'pointer resizing clears a previous keyboard resize mark');
    await page.screenshot({ path: `${output}/layers-resized-carbon-760.png` });
    assert.deepEqual(await saved(page), before);
    await page.getByRole('button', { name: 'Close Workbench Layers' }).click();
    await page.locator('[data-workbench-toolbar]').getByRole('button', { name: 'Layers', exact: true }).click();
    await drag('se', 20, 20); await page.evaluate(() => window.leaveEditor()); await page.mouse.up();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('real Layers order, groups, temporary eyes, deletion/Undo, reload and narrow desktop', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await fixture(page); await mkdir(output, { recursive: true });
    assert.deepEqual(await rows(page), ['image:eyes', 'text:mist', 'image:body', 'shape:landscape']);
    const paint = () => page.locator('[data-workbench-artwork]').evaluateAll(nodes => Object.fromEntries(nodes.map(node => [node.dataset.workbenchViewId, Number(getComputedStyle(node).zIndex)])));
    const startPaint = await paint(); assert.ok(startPaint['image:eyes'] > startPaint['text:mist'] && startPaint['text:mist'] > startPaint['image:body'] && startPaint['image:body'] > startPaint['shape:landscape']);
    await page.getByRole('button', { name: 'Select Body', exact: true }).click();
    assert.deepEqual(await paint(), startPaint, 'selection cannot change paint order');
    await page.getByRole('button', { name: 'Bring layers to front' }).click();
    await page.waitForFunction(() => window.savedDraft().artworkLayers.at(-1) === 'image:body');
    assert.ok((await paint())['image:body'] > (await paint())['image:eyes']);
    await undo(page);
    await page.getByRole('button', { name: 'Select Eyes', exact: true }).click({ modifiers: ['Shift'] });
    await page.getByRole('button', { name: 'Group selected layers' }).click();
    await page.getByLabel('Group name').fill('Person');
    await page.getByRole('button', { name: 'Create group', exact: true }).click();
    await page.waitForFunction(() => window.savedDraft().artworkLayers.some(item => item.name === 'Person'));
    const grouped = await saved(page); assert.deepEqual(grouped.artworkLayers.slice(0, 2), ['shape:landscape', 'text:mist']);
    await page.locator('.system-workflow').focus(); await page.keyboard.press('Delete');
    const blockRow = page.locator(`[data-layer-id="${grouped.artworkLayers.at(-1).id}"]`);
    assert.equal(await blockRow.locator('.workbench-layer-confirm').innerText(), 'Delete 2 layers?', 'Delete uses the new block even when its selected ids did not change');
    await page.getByRole('button', { name: 'Cancel layer deletion' }).click();
    await page.getByRole('button', { name: 'Expand Person' }).click();
    await page.getByRole('button', { name: 'Select Body', exact: true }).click();
    await page.getByRole('button', { name: 'Move layers forward' }).click();
    assert.deepEqual((await saved(page)).artworkLayers.at(-1).children, ['image:eyes', 'image:body']);
    const beforeEye = await saved(page);
    await page.getByRole('button', { name: 'Hide Body in editor' }).click();
    assert.equal(await page.locator('[data-workbench-view-id="image:body"]').evaluate(node => getComputedStyle(node).visibility), 'hidden');
    assert.deepEqual(await saved(page), beforeEye);
    await page.getByRole('button', { name: 'Show Body in editor' }).click();
    await page.getByRole('button', { name: 'Delete Body', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm layer deletion' }).click();
    await page.waitForFunction(() => window.savedDraft().imageModules.length === 1);
    assert.equal(await page.locator('[data-context-action-target]').count(), 0, 'successful deletion clears the departed target');
    await undo(page);
    await page.waitForFunction(() => window.savedDraft().imageModules.length === 2);
    assert.deepEqual((await saved(page)).imageModules, beforeEye.imageModules);
    assert.equal(await page.locator('[data-context-action-target]').count(), 0, 'Undo restores content without reviving a departed tool target');
    assert.deepEqual((await saved(page)).artworkLayers, beforeEye.artworkLayers);
    await page.screenshot({ path: `${output}/layers-1440.png` });
    await page.reload(); await page.getByRole('button', { name: 'Expand Person' }).waitFor();
    assert.deepEqual((await saved(page)).artworkLayers, beforeEye.artworkLayers);
    await page.setViewportSize({ width: 760, height: 850 });
    await page.screenshot({ path: `${output}/layers-760.png` });
    const bounds = await page.locator('.workbench-tool-dock').filter({ has: page.getByRole('tab', { name: 'Layers', exact: true }) }).boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 760);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('closed and hidden parts travel with their block; canvas Delete reopens Layers for inline confirmation', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await fixture(page, { grouped: true, closed: true });
    const before = await saved(page);
    await page.mouse.move(420, 320); await page.mouse.down(); await page.mouse.move(470, 350, { steps: 5 }); await page.mouse.up();
    await page.waitForFunction(() => window.savedDraft().workbench.imageModules[1].position.left !== 380);
    const moved = await saved(page);
    assert.equal(moved.workbench.imageModules[0].position.left - 260, moved.workbench.imageModules[1].position.left - 380);
    assert.equal(moved.workbench.imageModules[0].open, false);
    await page.getByRole('button', { name: 'Reopen Person', exact: true }).click();
    assert.equal((await page.locator('[data-workbench-view-id="image:body"]').boundingBox()).x, moved.workbench.imageModules[0].position.left);
    await undo(page);
    assert.deepEqual((await saved(page)).workbench, before.workbench);
    await page.getByRole('button', { name: 'Expand Person', exact: true }).click();
    await page.getByRole('button', { name: 'Hide Body in editor', exact: true }).click();
    await page.mouse.move(420, 320); await page.mouse.down(); await page.mouse.move(470, 350, { steps: 5 }); await page.mouse.up();
    await page.waitForFunction(() => window.savedDraft().workbench.imageModules[1].position.left !== 380);
    const hiddenMove = await saved(page);
    assert.equal(hiddenMove.workbench.imageModules[0].position.left - 260, hiddenMove.workbench.imageModules[1].position.left - 380);
    await page.getByRole('button', { name: 'Close Workbench Layers' }).click();
    await page.locator('.system-workflow').focus(); await page.keyboard.press('Delete');
    await page.getByRole('button', { name: 'Confirm layer deletion' }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal((await saved(page)).imageModules.length, 2);
  } finally { await browser.close(); }
});

test('drag and keyboard ordering, native Text deletion/Undo, outside focus and Carbon scrolling', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await fixture(page, { carbon: true, writing: true });
    const bodyRow = page.locator('[data-layer-id="image:body"]'), eyesRow = page.locator('[data-layer-id="image:eyes"]');
    await bodyRow.dragTo(eyesRow, { targetPosition: { x: 130, y: 4 } });
    await page.waitForFunction(() => window.savedDraft().artworkLayers.at(-1) === 'image:body');
    await page.getByRole('button', { name: 'Select Body', exact: true }).click(); await page.keyboard.press('Alt+ArrowDown');
    await page.waitForFunction(() => window.savedDraft().artworkLayers.at(-1) === 'image:eyes');
    await page.getByRole('button', { name: 'Select Mist', exact: true }).click();
    const text = page.getByRole('textbox', { name: 'Article text', exact: true });
    assert.equal(await text.innerText(), 'Native Text deletion');
    await text.focus(); await text.press('Control+A'); await text.press('Delete');
    await page.waitForFunction(() => document.querySelector('[aria-label="Article text"]').innerText.trim() === '');
    assert.equal(await page.getByRole('button', { name: 'Confirm layer deletion' }).count(), 0);
    assert.equal((await text.innerText()).trim(), '');
    await text.press('Control+z'); assert.equal(await text.innerText(), 'Native Text deletion');
    assert.equal((await saved(page)).texts.length, 1);
    await page.screenshot({ path: `${output}/layers-carbon-1440.png` });
    await fixture(page, { outside: true });
    await page.getByRole('button', { name: 'Select Body', exact: true }).dblclick();
    await page.getByRole('button', { name: 'Back to previous Workbench view' }).waitFor();
    assert.equal(await page.locator('[data-workbench-view-id="image:body"]').getAttribute('data-workbench-canvas-hidden'), null);
    await fixture(page, { carbon: true, many: true }); await page.setViewportSize({ width: 760, height: 850 });
    await page.getByRole('button', { name: 'Move Layers panel', exact: true }).focus();
    const list = page.locator('.workbench-layers-list');
    assert.ok(await list.evaluate(node => node.scrollHeight > node.clientHeight));
    await list.evaluate(node => { node.scrollTop = node.scrollHeight; });
    await page.getByRole('button', { name: 'Select Landscape', exact: true }).click();
    const panel = await page.locator('.workbench-tool-dock').filter({ has: page.getByRole('tab', { name: 'Layers', exact: true }) }).boundingBox();
    assert.ok(panel.x >= 0 && panel.x + panel.width <= 760 && panel.y + panel.height <= 850);
    await page.screenshot({ path: `${output}/layers-carbon-760-scroll.png` });
  } finally { await browser.close(); }
});

test('canvas block selection, atomic drag/Undo, explicit entry and Escape preserve geometry', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await fixture(page, { grouped: true });
    const before = await saved(page);
    await page.mouse.click(280, 200);
    await page.getByRole('group', { name: '2 selected Workbench modules', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Select Person', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.mouse.move(280, 200); await page.mouse.down(); await page.mouse.move(330, 240, { steps: 5 }); await page.mouse.up();
    await page.waitForFunction(() => window.savedDraft().workbench.imageModules[0].position.left !== 260);
    const moved = await saved(page);
    const dx = moved.workbench.imageModules[0].position.left - before.workbench.imageModules[0].position.left;
    assert.equal(moved.workbench.imageModules[1].position.left - before.workbench.imageModules[1].position.left, dx);
    assert.deepEqual(moved.artworkLayers, before.artworkLayers);
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => window.savedDraft().workbench.imageModules[0].position.left === 260);
    assert.deepEqual((await saved(page)).workbench.imageModules, before.workbench.imageModules);
    await page.getByRole('group', { name: '2 selected Workbench modules', exact: true }).focus();
    await page.keyboard.press('Enter');
    await page.locator('.workbench-layers-context').getByText('Person › Edit group contents').waitFor();
    await page.mouse.click(280, 200);
    await page.getByRole('button', { name: 'Expand Person' }).click();
    assert.equal(await page.getByRole('button', { name: 'Select Body', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.locator('[data-workbench-view-id="image:body"]').focus(); await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'Select Person', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('group', { name: '2 selected Workbench modules', exact: true }).dblclick({ position: { x: 30, y: 30 } });
    await page.getByRole('button', { name: 'Back to previous Workbench view' }).waitFor();
    assert.deepEqual((await saved(page)).artworkLayers, before.artworkLayers);
  } finally { await browser.close(); }
});

test('additive Layers selection derives its action target from the final group, including empty', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await fixture(page);
    const before = await saved(page);
    const selection = () => page.locator('.workbench-layer-row[data-selected]').evaluateAll(nodes => nodes.map(node => node.dataset.layerId).sort());
    const targets = () => page.locator('[data-context-action-target]').evaluateAll(nodes => nodes.map(node => node.dataset.contextActionTarget));
    const click = async (name, additive = false) => {
      await page.getByRole('button', { name: `Select ${name}`, exact: true }).click({ modifiers: additive ? ['Shift'] : [] });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    };
    await click('Eyes');
    assert.deepEqual(await selection(), ['image:eyes']);
    assert.deepEqual(await targets(), ['image:eyes']);
    await click('Body', true);
    assert.deepEqual(await selection(), ['image:body', 'image:eyes']);
    assert.deepEqual(await targets(), [], 'a group has no stale single-module tools');
    await page.locator('[data-workbench-view-id="text:mist"]').focus();
    assert.deepEqual(await selection(), ['image:body', 'image:eyes'], 'focus can visit another candidate without replacing the explicit group');
    assert.deepEqual(await targets(), []);
    await click('Body', true);
    assert.deepEqual(await selection(), ['image:eyes']);
    assert.deepEqual(await targets(), ['image:eyes'], 'toggle derives the surviving target, not the clicked row');
    await click('Eyes', true);
    assert.deepEqual(await selection(), []);
    assert.deepEqual(await targets(), [], 'toggling the final member off clears the tool target');
    await page.mouse.click(280, 200);
    assert.deepEqual(await selection(), ['image:body'], 'ordinary canvas click selects the same artwork as Layers');
    assert.deepEqual(await targets(), ['image:body']);
    await page.keyboard.down('Shift'); await page.mouse.click(280, 200); await page.keyboard.up('Shift');
    assert.deepEqual(await selection(), [], 'Shift-click can toggle the last canvas selection off');
    assert.deepEqual(await targets(), []);
    assert.deepEqual(await saved(page), before, 'selection never rewrites the composition');
  } finally { await browser.close(); }
});

test('cancelled canvas marquee restores ordinary module tools and explicit group handles', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await fixture(page, { selectionOnly: true });
    const before = await saved(page);
    const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const state = () => page.evaluate(() => ({
      ids: [...document.querySelectorAll('.workbench-layer-row[data-selected]')].map(n => n.dataset.layerId).sort(),
      targets: [...document.querySelectorAll('[data-context-action-target]')].map(n => n.dataset.contextActionTarget),
      groups: document.querySelectorAll('.workbench-selection').length,
    }));
    for (const name of ['Body', 'Landscape', 'group']) for (const cancel of ['Escape', 'capture loss']) {
      await page.getByRole('button', { name: `Select ${name === 'group' ? 'Body' : name}`, exact: true }).click();
      if (name === 'group') await page.getByRole('button', { name: 'Select Eyes', exact: true }).click({ modifiers: ['Shift'] });
      await settle(); const selected = await state();
      assert.equal(selected.groups, name === 'group' ? 1 : 0);
      const host = page.locator('main.system-workflow').first();
      assert.equal(await page.evaluate(() => document.elementFromPoint(1200, 750)?.matches('main.system-workflow, .workbench-canvas-content')), true, 'marquee starts on real canvas');
      await page.mouse.move(1200, 750); await page.mouse.down(); await page.mouse.move(1270, 820, { steps: 3 });
      await settle(); assert.deepEqual((await state()).ids, [], 'preview changes the selection');
      if (cancel === 'Escape') await page.keyboard.press('Escape');
      else await host.dispatchEvent('lostpointercapture', { pointerId: 1 });
      await page.mouse.up(); await settle();
      assert.deepEqual(await state(), selected, `${name}: ${cancel} restores handles and tools`);
    }
    assert.deepEqual(await saved(page), before, 'marquee preview and cancellation never edit the composition');
  } finally { await browser.close(); }
});

test('closed Image recovery, inline cancel, storage failure and visitor order', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await fixture(page, { closed: true });
    await page.getByRole('button', { name: 'Reopen Body', exact: true }).click();
    await page.locator('[data-workbench-view-id="image:body"]').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Close Body', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Delete Body', exact: true }).click();
    // The deleted row button loses focus; the confirmation focuses Cancel on
    // the next paint. Send Escape to that ready surface, not the document body.
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Cancel layer deletion');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('button', { name: 'Confirm layer deletion' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Delete Body', exact: true }).evaluate(node => document.activeElement === node), true);
    await page.evaluate(() => { window.normalSetItem = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) {
      if (key.startsWith('inscape.system-workflow-draft.')) throw Error('full'); return window.normalSetItem.call(this, key, value);
    }; });
    await page.getByRole('button', { name: 'Select Body', exact: true }).click();
    const before = await saved(page);
    await page.getByRole('button', { name: 'Delete Body', exact: true }).click(); await page.getByRole('button', { name: 'Confirm layer deletion' }).click();
    await page.getByRole('alert').filter({ hasText: 'Could not save' }).waitFor();
    assert.deepEqual(await saved(page), before);
    assert.equal(await page.getByRole('button', { name: 'Select Body', exact: true }).count(), 0, 'failed deletion keeps its inline recovery');
    assert.equal(await page.locator('.workbench-layer-row[data-layer-id="image:body"]').getAttribute('data-selected'), 'true');
    assert.equal(await page.locator('[data-context-action-target]').getAttribute('data-context-action-target'), 'image:body', 'failed save retains the selected tool target');
    await page.evaluate(() => { Storage.prototype.setItem = window.normalSetItem; });
    await page.getByRole('button', { name: 'Cancel layer deletion' }).click();
    await page.getByRole('button', { name: 'Select Landscape', exact: true }).click();
    await page.getByRole('button', { name: 'Bring layers to front' }).click();
    const owner = await saved(page);
    await page.evaluate(async () => {
      const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
      const Preview = (await import('/src/profileDocument/components/ProfileDocumentV9Preview.jsx')).default;
      const { buildProfileDocumentV9 } = await import('/src/profileDocument/domain/profileDocumentV9Builder.js');
      const document = buildProfileDocumentV9({ profileAddress: window.fixtureProfile, systemWorkflowDraft: window.savedDraft() });
      window.leaveEditor(); createRoot(window.document.getElementById('root')).render(React.createElement(Preview, { document }));
    });
    await page.locator('[data-workbench-artwork]').first().waitFor();
    const paint = await page.locator('[data-workbench-artwork]').evaluateAll(nodes => Object.fromEntries(nodes.map(node => [node.dataset.workbenchViewId, Number(getComputedStyle(node).zIndex)])));
    assert.ok(paint['shape:landscape'] > paint['image:eyes']);
    assert.equal(await page.locator('[data-workbench-layers]').count(), 0);
    assert.deepEqual(await saved(page), owner);
  } finally { await browser.close(); }
});


test('Workbench A to B to A drops the old group; Visitor selection has no owner writer', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await fixture(page, { selectionOnly: true });
    const aId = await page.getByRole('combobox', { name: 'Active Workbench' }).inputValue();
    await page.getByRole('button', { name: 'Select Eyes', exact: true }).click();
    await page.getByRole('button', { name: 'Select Body', exact: true }).click({ modifiers: ['Shift'] });
    assert.equal(await page.locator('.workbench-layer-row[data-selected]').count(), 2);
    const original = await page.evaluate(() => window.guardedStore().getDraft());
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.getByLabel('New Workbench name', { exact: true }).fill('Selection B');
    await page.getByRole('button', { name: 'Create Workbench', exact: true }).click();
    await page.waitForFunction(() => window.guardedStore().listWorkbenches().length === 2 && !window.guardedStore().getDraft().imageModules?.length);
    assert.equal(await page.locator('.workbench-layer-row[data-selected]').count(), 0);
    assert.equal(await page.locator('[data-context-action-target]').count(), 0);
    await page.getByRole('combobox', { name: 'Active Workbench' }).selectOption(aId);
    await page.getByRole('button', { name: 'Select Body', exact: true }).waitFor();
    assert.equal(await page.locator('.workbench-layer-row[data-selected]').count(), 0, 'the previous explicit group is not restored into the new activation');
    assert.equal(await page.locator('[data-context-action-target]').count(), 0);
    assert.deepEqual(await page.evaluate(() => window.guardedStore().getDraft().imageModules), original.imageModules);
    await page.evaluate(async () => {
      const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
      const Preview = (await import('/src/profileDocument/components/ProfileDocumentV9Preview.jsx')).default;
      const { buildProfileDocumentV9 } = await import('/src/profileDocument/domain/profileDocumentV9Builder.js');
      const published = buildProfileDocumentV9({ profileAddress: window.fixtureProfile, systemWorkflowDraft: window.guardedStore().getDraft() });
      window.leaveEditor();
      window.visitorBefore = window.savedDraft(); window.visitorWrites = 0;
      const write = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) { if (key.startsWith('inscape.system-workflow-draft.')) window.visitorWrites++; return write.call(this, key, value); };
      createRoot(window.document.getElementById('root')).render(React.createElement(Preview, { document: published }));
    });
    const image = page.locator('[data-workbench-view-id="image:body"]'); await image.waitFor();
    await image.locator('[data-workbench-selectable]').first().focus(); await page.keyboard.press('Shift+Enter');
    await page.getByRole('group', { name: '1 selected Workbench modules', exact: true }).waitFor();
    assert.equal(await page.locator('[data-workbench-layers]').count(), 0);
    assert.equal(await page.locator('[data-context-action-target]').count(), 0);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.workbench-selection').count(), 0);
    assert.equal(await page.evaluate(() => window.visitorWrites), 0);
    assert.deepEqual(await page.evaluate(() => window.savedDraft()), await page.evaluate(() => window.visitorBefore));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
