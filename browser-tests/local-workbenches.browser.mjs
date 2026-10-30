import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';

const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5217';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/local-workbenches';
const url = `${origin}/browser-tests/workbench-storage-fixture.html?seed=1`;
const current = page => page.evaluate(() => window.guardedStore().getDraft());
const record = page => page.evaluate(() => window.savedDraft());
let diagnosticIndex = 0;
async function open(page, selection = false) {
  page.setDefaultTimeout(15000);
  const outstanding = new Map(), responses = [], errors = [];
  page.on('request', request => outstanding.set(request, { url: request.url(), type: request.resourceType() }));
  page.on('requestfinished', request => outstanding.delete(request));
  page.on('requestfailed', request => outstanding.delete(request));
  page.on('response', response => responses.push({ url: response.url(), status: response.status() }));
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  try { await page.goto(selection ? `${url}&selection=1` : url); }
  catch (error) {
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, `navigation-${++diagnosticIndex}.json`), JSON.stringify({
      outstanding: [...outstanding.values()], responses, errors,
      state: await page.evaluate(() => ({ ready: document.readyState, url: location.href, text: document.body.innerText.slice(0, 2000) })).catch(() => null),
    }, null, 2));
    await page.screenshot({ path: path.join(output, `navigation-${diagnosticIndex}.png`) }).catch(() => {});
    throw error;
  }
  await page.getByRole('combobox', { name: 'Active Workbench' }).waitFor();
  await page.locator('.text-window').waitFor();
}
async function rename(page, name) {
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByLabel('Workbench name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save name', exact: true }).click();
}
async function create(page, name) {
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await page.getByLabel('New Workbench name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Create Workbench', exact: true }).click();
}
async function write(page, text) {
  const editor = page.getByRole('textbox', { name: 'Article text', exact: true });
  if (!await editor.isVisible()) {
    await page.locator('.text-window').click({ position: { x: 80, y: 90 } });
    await page.getByRole('button', { name: 'Write', exact: true }).click();
  }
  await editor.fill(text);
  await page.getByRole('combobox', { name: 'Active Workbench' }).focus();
}
async function failWrites(page, fail) {
  await page.evaluate(fail => {
    if (!window.normalSetItem) window.normalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = fail ? function(key, value) {
      if (key.startsWith('inscape.system-workflow-draft.')) throw new DOMException('Full', 'QuotaExceededError');
      return window.normalSetItem.call(this, key, value);
    } : window.normalSetItem;
  }, fail);
}

const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const selectedFrames = page => page.locator('[data-workbench-view-id="text:private"], [data-workbench-view-id="image:gesture"]').evaluateAll(nodes =>
  nodes.map(node => { const { x, y, width, height } = node.getBoundingClientRect(); return { id: node.dataset.workbenchViewId, x, y, width, height }; }));
async function selectMixed(page) {
  await page.locator('[data-workbench-view-id="image:gesture"]').waitFor();
  // Start the canvas operation from Read with the actual tool controls closed.
  // Otherwise the Text toolbar occupies the marquee's empty-canvas start point.
  const collapse = page.getByRole('button', { name: 'Collapse sidebar', exact: true });
  if (await collapse.count()) await collapse.click();
  const read = page.getByRole('button', { name: 'Read', exact: true });
  if (await read.count()) { await read.focus(); await page.keyboard.press('Enter'); }
  for (const name of ['Close Text tools', 'Close Transform', 'Close Color', 'Close Image', 'Close Shape', 'Close FX', 'Close Info']) {
    const close = page.getByRole('button', { name, exact: true });
    if (await close.count()) await close.click();
  }
  await settle(page);
  const frames = await selectedFrames(page);
  assert.equal(frames.length, 2);
  const left = Math.min(...frames.map(frame => frame.x)), top = Math.min(...frames.map(frame => frame.y));
  const right = Math.max(...frames.map(frame => frame.x + frame.width)), bottom = Math.max(...frames.map(frame => frame.y + frame.height));
  const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.outerHTML.slice(0, 500), { x: right + 20, y: bottom + 20 });
  await page.mouse.move(right + 20, bottom + 20);
  await page.mouse.down();
  // Marquee selection requires complete containment of both module rectangles.
  await page.mouse.move(left - 20, top - 20, { steps: 5 });
  await page.mouse.up();
  try { await page.getByRole('group', { name: '2 selected Workbench modules', exact: true }).waitFor(); }
  catch (error) {
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, `mixed-selection-${++diagnosticIndex}.json`), JSON.stringify({ frames, hit,
      groups: await page.getByRole('group').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label'))),
    }, null, 2));
    await page.screenshot({ path: path.join(output, `mixed-selection-${diagnosticIndex}.png`) });
    throw error;
  }
  const close = page.getByRole('button', { name: 'Close Transform', exact: true });
  if (await close.count()) await close.click();
}
async function beginMixedGesture(page, kind = 'resize') {
  const target = kind === 'resize'
    ? page.getByRole('button', { name: 'Scale selected modules from se', exact: true })
    : page.getByRole('group', { name: '2 selected Workbench modules', exact: true });
  const box = await target.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  if (kind === 'move') assert.ok(await page.evaluate(({ x, y }) => {
    const hit = document.elementFromPoint(x, y);
    return Boolean(hit?.matches('.workbench-selection'));
  }, { x, y }), 'the selection surface receives the actual pointer drag');
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 60, y + 40, { steps: 4 });
  await settle(page);
}

test('active mixed selection gestures block canvas switching and Escape restores both module frames', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await open(page, true);
    const chooser = page.getByRole('combobox', { name: 'Active Workbench' });
    const aId = await chooser.inputValue();
    await create(page, 'Other');
    const bId = await chooser.inputValue();
    await chooser.selectOption(aId);
    await selectMixed(page);
    for (const kind of ['move', 'resize']) {
      const before = await record(page), frames = await selectedFrames(page);
      await beginMixedGesture(page, kind);
      assert.notDeepEqual(await selectedFrames(page), frames, `${kind} has a visible temporary preview`);
      await chooser.selectOption(bId);
      await page.getByRole('region', { name: 'Local Workbenches' }).getByRole('alert')
        .filter({ hasText: 'Finish or cancel the canvas gesture' }).waitFor();
      assert.equal(await chooser.inputValue(), aId);
      assert.deepEqual(await record(page), before, 'the rejected switch cannot save the preview');
      if (kind === 'resize') await page.screenshot({ path: path.join(output, 'mixed-resize-switch-guard.png') });
      await page.keyboard.press('Escape'); await page.mouse.up(); await settle(page);
      assert.deepEqual(await selectedFrames(page), frames);
      assert.deepEqual(await record(page), before);
    }
    await chooser.selectOption(bId);
    assert.equal(await page.locator('.text-window').count(), 0);
    await chooser.selectOption(aId);
    await page.locator('.text-window').waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('mixed selection UI completion rejects a failed save, then keyboard resize saves both modules with one Undo', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await open(page, true); await selectMixed(page);
    const before = await record(page), frames = await selectedFrames(page);
    await failWrites(page, true);
    await beginMixedGesture(page); await page.mouse.up(); await settle(page);
    assert.deepEqual(await record(page), before);
    assert.deepEqual(await selectedFrames(page), frames, 'failed completion rolls both previews back');
    await page.getByRole('alert').filter({ hasText: 'The selection could not be saved' }).first().waitFor();
    await page.screenshot({ path: path.join(output, 'mixed-resize-failed-save.png') });
    await failWrites(page, false);
    const handle = page.getByRole('button', { name: 'Scale selected modules from se', exact: true });
    await handle.focus(); await page.keyboard.press('ArrowRight');
    await page.waitForFunction(width => window.savedDraft().imageModules[0].width !== width, before.imageModules[0].width);
    const saved = await record(page);
    assert.notDeepEqual(saved.workbench.texts[0].window, before.workbench.texts[0].window);
    assert.deepEqual(saved.texts, before.texts, 'resizing preserves the article');
    await page.screenshot({ path: path.join(output, 'mixed-resize-keyboard-saved.png') });
    await page.getByRole('combobox', { name: 'Active Workbench' }).focus();
    await page.keyboard.press('Control+z');
    await page.waitForFunction(width => window.savedDraft().imageModules[0].width === width, before.imageModules[0].width);
    const undone = await record(page);
    assert.deepEqual(undone.imageModules, before.imageModules);
    assert.deepEqual(undone.workbench, before.workbench, 'one Undo restores both authored module frames');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('forced editor unmount discards a mixed resize preview and ignores the late pointer completion', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await open(page, true); await selectMixed(page);
    const before = await record(page), frames = await selectedFrames(page);
    await beginMixedGesture(page);
    assert.notDeepEqual(await selectedFrames(page), frames);
    await page.evaluate(() => window.leaveEditor());
    await page.locator('.text-window').waitFor({ state: 'detached' });
    await page.mouse.up(); await page.keyboard.press('ArrowRight'); await settle(page);
    assert.deepEqual(await record(page), before);
    await page.reload();
    await page.locator('.text-window').waitFor();
    assert.deepEqual(await record(page), before, 'reopening keeps the accepted state from before the unfinished gesture');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('named local Workbenches keep separate content and canvas geometry through UI switches, Undo and reload', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await open(page);
    await write(page, 'Lunar Desert keeps this text.');
    await rename(page, 'Lunar Desert');
    const aId = await page.getByRole('combobox', { name: 'Active Workbench' }).inputValue();
    await page.getByRole('button', { name: 'Canvas size', exact: true }).click();
    await page.getByRole('button', { name: 'Fit canvas to content', exact: true }).click();
    await page.getByRole('button', { name: 'Close canvas size', exact: true }).click();
    const a = await current(page);
    await create(page, 'Studies');
    await page.waitForFunction(() => window.guardedStore().listWorkbenches().length === 2
      && !window.guardedStore().getDraft().texts?.length);
    const bId = await page.getByRole('combobox', { name: 'Active Workbench' }).inputValue();
    assert.notEqual(aId, bId);
    assert.equal(await page.locator('.text-window').count(), 0);
    assert.ok(await page.getByRole('combobox', { name: 'Active Workbench' }).evaluate(node => document.activeElement === node));
    await page.getByRole('button', { name: 'Text tool', exact: true }).click();
    await page.mouse.click(750, 240);
    await page.locator('.text-window').waitFor();
    await write(page, 'Studies keeps independent text.');
    const b = await current(page);
    assert.notEqual(a.texts[0].id, b.texts[0].id);
    assert.notDeepEqual(a.workbench.area, b.workbench.area);
    await page.getByRole('combobox', { name: 'Active Workbench' }).selectOption(aId);
    await page.waitForFunction(() => window.guardedStore().getDraft().texts?.[0]?.article.content.content.some(node => JSON.stringify(node).includes('Lunar Desert')));
    assert.deepEqual((await current(page)).texts, a.texts);
    assert.deepEqual((await current(page)).workbench.area, a.workbench.area);
    await page.getByRole('combobox', { name: 'Active Workbench' }).selectOption(bId);
    assert.deepEqual((await current(page)).texts, b.texts);
    await page.getByRole('combobox', { name: 'Active Workbench' }).focus();
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => !JSON.stringify(window.guardedStore().getDraft().texts).includes('Studies keeps independent text.'));
    await page.keyboard.press('Control+Shift+z');
    await page.waitForFunction(() => JSON.stringify(window.guardedStore().getDraft().texts).includes('Studies keeps independent text.'));
    await page.reload();
    await page.getByRole('combobox', { name: 'Active Workbench' }).waitFor();
    assert.equal(await page.getByRole('combobox', { name: 'Active Workbench' }).inputValue(), bId);
    assert.deepEqual((await current(page)).texts, b.texts);
    await page.getByRole('combobox', { name: 'Active Workbench' }).selectOption(aId);
    assert.deepEqual((await current(page)).texts, a.texts);
    const beforeReview = await record(page);
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    const publication = page.getByRole('complementary', { name: 'Publish profile' });
    await publication.waitFor();
    assert.equal(await publication.getByRole('checkbox', { name: /Lunar Desert/ }).isChecked(), true);
    assert.equal(await publication.getByRole('checkbox', { name: /Studies/ }).isChecked(), false);
    await publication.getByRole('button', { name: 'Close Publication', exact: true }).click();
    await publication.waitFor({ state: 'detached' });
    assert.deepEqual(await record(page), beforeReview, 'Opening publication review does not change either saved canvas');
    await mkdir(output, { recursive: true });
    for (const width of [1440, 700, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const box = await page.getByRole('region', { name: 'Local Workbenches', exact: true }).boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width, 'switcher stays inside narrow windows');
      await page.screenshot({ path: path.join(output, `workbenches-${width}.png`) });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download all Workbenches', exact: true }).click();
    const backup = JSON.parse(await readFile(await (await downloading).path(), 'utf8'));
    assert.equal(backup.draft.workbenches.length, 2);
    assert.deepEqual(backup.draft.workbenches.map(item => item.name), ['Lunar Desert', 'Studies']);
    const other = await context.newPage();
    await other.goto(url);
    await other.getByRole('heading', { name: 'This tab is view-only' }).waitFor();
    assert.equal(await other.getByRole('combobox', { name: 'Active Workbench' }).count(), 0, 'profile lease still excludes a second editor');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('multi-Workbench publication review selects the active canvas and changes scope without writing or uploading', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await open(page);
    await create(page, 'Private second Workbench');
    await page.waitForFunction(() => window.guardedStore().listWorkbenches().length === 2);
    const saved = await record(page), requests = [];
    page.on('request', request => { if (/pin-profile-document|ipfs|rpc/.test(request.url())) requests.push(request.url()); });
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    const publication = page.getByRole('complementary', { name: 'Publish profile' });
    await publication.waitFor();
    const original = publication.getByRole('checkbox', { name: /Workbench 1/ });
    const second = publication.getByRole('checkbox', { name: /Private second Workbench/ });
    assert.equal(await original.isChecked(), false, 'The other canvas does not join publication implicitly');
    assert.equal(await second.isChecked(), true, 'Review defaults to the current canvas');
    await original.check();
    await second.uncheck();
    assert.equal(await original.isChecked(), true);
    assert.equal(await second.isChecked(), false, 'An unselected private canvas stays outside the requested publication scope');
    assert.equal(await publication.getByRole('button', { name: 'Prepare publication', exact: true }).isEnabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Make presentation public', exact: true }).count(), 0);
    await publication.getByRole('button', { name: 'Close Publication', exact: true }).click();
    await publication.waitFor({ state: 'detached' });
    assert.deepEqual(await record(page), saved);
    assert.deepEqual(requests, []);
  } finally { await browser.close(); }
});

test('failed saves and pending Text keep the current Workbench open until recovery succeeds', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await open(page); await rename(page, 'A');
    const aId = await page.getByRole('combobox', { name: 'Active Workbench' }).inputValue();
    const before = await record(page);
    await failWrites(page, true);
    await create(page, 'B');
    await page.getByRole('region', { name: 'Local Workbenches' }).getByRole('alert').waitFor();
    assert.deepEqual(await record(page), before);
    assert.equal(await page.getByRole('combobox', { name: 'Active Workbench' }).inputValue(), aId);
    assert.equal(await page.getByLabel('New Workbench name').inputValue(), 'B');
    await failWrites(page, false);
    await page.getByRole('button', { name: 'Create Workbench', exact: true }).click();
    await page.waitForFunction(() => window.guardedStore().listWorkbenches().length === 2);
    const bId = await page.getByRole('combobox', { name: 'Active Workbench' }).inputValue();
    await page.getByRole('combobox', { name: 'Active Workbench' }).selectOption(aId);
    await failWrites(page, true);
    await write(page, 'Keep this failed edit.');
    await page.getByRole('button', { name: 'Retry local save', exact: true }).waitFor();
    await page.getByRole('combobox', { name: 'Active Workbench' }).selectOption(bId);
    await page.getByRole('region', { name: 'Local Workbenches' }).getByRole('alert').filter({ hasText: 'unsaved changes' }).waitFor();
    assert.equal(await page.getByRole('combobox', { name: 'Active Workbench' }).inputValue(), aId);
    await failWrites(page, false);
    await page.getByRole('button', { name: 'Retry local save', exact: true }).click();
    await page.getByRole('combobox', { name: 'Active Workbench' }).selectOption(bId);
    await page.getByRole('combobox', { name: 'Active Workbench' }).selectOption(aId);
    assert.ok(JSON.stringify((await current(page)).texts).includes('Keep this failed edit.'));
  } finally { await browser.close(); }
});

test('naming validates input, retries failed writes and commits the visible layout without remounting Text', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await open(page);
    const before = await record(page);
    await rename(page, '   ');
    await page.getByRole('alert').filter({ hasText: '1–64' }).waitFor();
    assert.deepEqual(await record(page), before);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByLabel('Workbench name', { exact: true }).count(), 0);
    assert.ok(await page.getByRole('combobox', { name: 'Active Workbench' }).evaluate(node => document.activeElement === node));
    const header = page.locator('.text-window header[data-workbench-selectable]');
    const original = await page.locator('.text-window').boundingBox();
    await header.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    const moved = await page.locator('.text-window').boundingBox();
    assert.notEqual(moved.x, original.x);
    assert.notEqual(moved.y, original.y);
    await page.evaluate(() => { window.originalTextWindow = document.querySelector('.text-window'); });
    const beforeRename = await record(page);
    await failWrites(page, true);
    await rename(page, 'Lunar Desert');
    await page.getByRole('alert').filter({ hasText: 'Could not save the Workbench' }).waitFor();
    assert.deepEqual(await record(page), beforeRename);
    assert.equal(await page.getByLabel('Workbench name', { exact: true }).inputValue(), 'Lunar Desert');
    await failWrites(page, false);
    await page.getByRole('button', { name: 'Save name', exact: true }).click();
    assert.ok(await page.evaluate(() => window.originalTextWindow === document.querySelector('.text-window')));
    const saved = await current(page);
    assert.notDeepEqual(saved.workbench.texts[0].window, before.workbench.texts[0].window);
    assert.equal((await record(page)).workbenches[0].name, 'Lunar Desert');
    await page.reload();
    await page.locator('.text-window').waitFor();
    assert.deepEqual((await current(page)).workbench, saved.workbench);
    const reloaded = await page.locator('.text-window').boundingBox();
    assert.ok(Math.abs(reloaded.x - moved.x) < 1 && Math.abs(reloaded.y - moved.y) < 1);
  } finally { await browser.close(); }
});

test('all eight local Workbenches stay reachable, with an explained limit and usable naming forms', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    await open(page);
    const firstId = await page.getByRole('combobox', { name: 'Active Workbench' }).inputValue();
    for (let index = 2; index <= 8; index++) await create(page, `Composition ${index}`);
    assert.equal(await page.getByRole('combobox', { name: 'Active Workbench' }).locator('option').count(), 8);
    assert.ok(await page.getByRole('button', { name: 'New', exact: true }).isDisabled());
    await page.getByText('Saved locally · all 8 Workbench slots are in use.', { exact: true }).waitFor();
    const lastId = await page.getByRole('combobox', { name: 'Active Workbench' }).inputValue();
    await page.getByRole('combobox', { name: 'Active Workbench' }).selectOption(firstId);
    await page.locator('.text-window').waitFor();
    await page.getByRole('button', { name: 'Rename', exact: true }).click();
    await page.getByLabel('Workbench name', { exact: true }).fill('Lunar Desert — a long composition name for a narrow screen');
    await mkdir(output, { recursive: true });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const form = page.locator('.workbench-switcher__form');
      const box = await form.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width);
      assert.ok(await form.evaluate(node => node.scrollWidth <= node.clientWidth));
      assert.ok(await page.getByLabel('Workbench name', { exact: true }).evaluate(node => {
        const box = node.getBoundingClientRect();
        return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === node;
      }), 'the sidebar cannot cover the name field');
      await page.screenshot({ path: path.join(output, `workbenches-naming-${width}.png`) });
    }
    await page.getByRole('button', { name: 'Save name', exact: true }).click();
    await page.getByRole('combobox', { name: 'Active Workbench' }).selectOption(lastId);
    assert.equal(await page.locator('.text-window').count(), 0);
    await page.reload();
    await page.getByRole('combobox', { name: 'Active Workbench' }).waitFor();
    assert.equal(await page.getByRole('combobox', { name: 'Active Workbench' }).inputValue(), lastId);
    assert.equal((await record(page)).workbenches.length, 8);
  } finally { await browser.close(); }
});
