import { openEditorMenu, editorMenu, editorCommand, activeEditorDocument } from './fixtures/editor-menu.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/workbench-storage';
const url = `${origin}/browser-tests/workbench-storage-fixture.html?seed=1`;
const route = route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort();
async function open(page, target = url) { page.setDefaultTimeout(15000); await page.route('**/*', route); await page.goto(target); }
async function settings(page) { await openEditorMenu(page, 'Backup'); return page.getByRole('region', { name: 'Workbench backup', exact: true }); }
const upload = (panel, source) => panel.getByLabel('Open Workbench backup', { exact: true }).setInputFiles({ name: 'workbench.json', mimeType: 'application/json', buffer: Buffer.from(source) });

test('two real tabs have one editor, separate profiles remain independent, and closing releases access', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const context = await browser.newContext(), a = await context.newPage(), b = await context.newPage();
    await open(a); await a.locator('aside.text-window').waitFor();
    await open(b); await b.getByRole('heading', { name: 'This tab is view-only' }).waitFor();
    await mkdir(output, { recursive: true });
    for (const width of [1440, 390]) { await b.setViewportSize({ width, height: 1000 }); await b.screenshot({ path: path.join(output, `view-only-${width}.png`) }); }
    assert.equal(await b.locator('aside.text-window').count(), 0);
    const refusal = await b.evaluate(() => { const s = window.guardedStore(), d = s.getDraft(); d.identityPresentation.alias = 'Rejected'; return { saved: s.commitCompletedOperation(d, { expectedGeneration: s.getGeneration() }), reason: s.getLastCommitFailure() }; });
    assert.deepEqual(refusal, { saved: false, reason: 'editor_unavailable' });
    const c = await context.newPage(); await open(c, `${url}&profile=0x${'2'.repeat(40)}`); await c.locator('aside.text-window').waitFor();
    await a.evaluate(() => { window.staleStore = window.guardedStore(); window.leaveEditor(); });
    assert.equal(await a.evaluate(() => window.staleStore.commitCompletedOperation(window.staleStore.getDraft(), { expectedGeneration: window.staleStore.getGeneration() })), false);
    await b.getByRole('button', { name: 'Try editing here' }).click(); await b.locator('aside.text-window').waitFor();
    await b.close();
    const d = await context.newPage(); await open(d); await d.locator('aside.text-window').waitFor();
    await mkdir(output, { recursive: true }); await writeFile(path.join(output, 'two-tabs.json'), JSON.stringify({ competingWrite: refusal, profileIsolation: true, staleWriteRejected: true, closeReleases: true }, null, 2));
  } finally { await browser.close(); }
});

for (const width of [1440, 390]) test(`full private backup downloads, validates, cancels, restores, and survives reload at ${width}px`, { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await open(page); await page.locator('aside.text-window').waitFor();
    let panel = await settings(page);
    const downloading = page.waitForEvent('download'); await panel.getByRole('button', { name: 'Download workspace backup', exact: true }).click();
    const source = await readFile(await (await downloading).path(), 'utf8'), backup = JSON.parse(source);
    assert.equal(backup.workspace.workbenches.workbenches[0].content.texts[0].visibility, 'PRIVATE'); assert.equal(backup.workspace.workbenches.workbenches[0].content.texts[0].article.title, 'Private draft');
    const before = await page.evaluate(() => window.savedDraft());
    await upload(panel, '{broken'); await panel.getByText('Choose a valid INSCAPE Workbench JSON backup.').waitFor();
    await upload(panel, source); await panel.getByRole('button', { name: 'Cancel restore' }).click(); assert.deepEqual(await page.evaluate(() => window.savedDraft()), before);
    const foreign = structuredClone(backup); foreign.profileAddress = `0x${'2'.repeat(40)}`;
    await upload(panel, JSON.stringify(foreign)); await panel.getByText(/Open the matching workspace/).waitFor();
    const restored = structuredClone(backup); restored.workspace.workbenches.workbenches[0].content.texts[0].article.title = 'Restored private composition'; restored.workspace.workbenches.workbenches[0].content.workbench.texts[0].window.left = 110;
    await upload(panel, JSON.stringify(restored));
    await mkdir(output, { recursive: true }); await panel.getByRole('button', { name: 'Confirm Replace' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `backup-confirm-${width}.png`) });
    await panel.getByRole('button', { name: 'Confirm Replace' }).click();
    await page.waitForFunction(() => window.savedDraft()?.workbenches?.[0].content.texts[0].article.title === 'Restored private composition');
    assert.deepEqual(await page.evaluate(() => window.savedDraft()), restored.workspace.workbenches);
    await page.reload(); await page.locator('aside.text-window').waitFor(); assert.deepEqual(await page.evaluate(() => window.savedDraft()), restored.workspace.workbenches);
    const projectedLeft = await page.locator('main.system-workflow').evaluate(host =>
        110 * Number(host.dataset.workbenchCameraScale) + Number(host.dataset.workbenchCameraX));
      assert.ok(Math.abs((await page.locator('aside.text-window').boundingBox()).x - projectedLeft) < 1, 'the restored authored position is painted through the current camera after reload');
    await page.screenshot({ path: path.join(output, `restored-${width}.png`) });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('an unpublished corrupt draft exposes backup recovery without deleting the corrupt record first', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage(); await open(page); await page.locator('aside.text-window').waitFor();
    const draft = await page.evaluate(() => window.savedDraft());
    await page.evaluate(() => window.externalWorkbenchWrite('{broken'));
    await page.reload(); await page.getByRole('heading', { name: 'Local workspace could not be opened' }).waitFor();
    assert.equal(await page.evaluate(() => window.committedRaw()), '{broken');
    const panel = page.getByRole('region', { name: 'Workbench backup', exact: true });
    await upload(panel, JSON.stringify({ type: 'inscape-private-workbench', version: 1, createdAt: new Date().toISOString(), draft }));
    await panel.getByRole('button', { name: 'Confirm Replace' }).click();
    await page.locator('aside.text-window').waitFor(); assert.deepEqual(await page.evaluate(() => window.savedDraft()), draft);
  } finally { await browser.close(); }
});

test('restore errors retain saved bytes and a delayed file cannot replace subsequently edited work', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage(); await open(page); await page.locator('aside.text-window').waitFor();
    let panel = await settings(page);
    const original = await page.evaluate(() => window.savedDraft());
    const changed = structuredClone(original); changed.texts[0].article.title = 'Backup replacement';
    const source = JSON.stringify({ type: 'inscape-private-workbench', version: 1, createdAt: new Date().toISOString(), draft: changed });
    await upload(panel, source);
    await page.evaluate(() => { const put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function(...args) { if (this.name === 'records') throw new DOMException('Full', 'QuotaExceededError'); return put.apply(this, args); }; window.restoreWrites = () => { IDBObjectStore.prototype.put = put; }; });
    await panel.getByRole('button', { name: 'Confirm Replace' }).click();
    await panel.getByText(/Device storage is full/).waitFor(); assert.deepEqual(await page.evaluate(() => window.savedDraft()), original);
    await page.evaluate(() => window.restoreWrites());
    // A visible concurrent change must still be refused, even with the editor lock.
    await page.evaluate(() => { const draft = window.savedDraft(); draft.identityPresentation.alias = 'Externally changed'; return window.externalWorkbenchWrite(JSON.stringify(draft)); });
    await panel.getByRole('button', { name: 'Confirm Replace' }).click();
    await panel.getByText(/Workspace changed since preview/).waitFor();
    await page.reload(); await page.locator('aside.text-window').waitFor();
    assert.equal(await page.evaluate(() => window.savedDraft().identityPresentation.alias), 'Externally changed');
    assert.equal(await page.evaluate(() => window.savedDraft().texts[0].article.title), 'Private draft');
    await page.reload(); await page.locator('aside.text-window').waitFor(); panel = await settings(page);
    await page.evaluate(() => { const text = File.prototype.text; File.prototype.text = async function() { const value = await text.call(this); await new Promise(resolve => { window.finishRead = resolve; }); return value; }; });
    await upload(panel, source); await page.waitForFunction(() => Boolean(window.finishRead));
    await page.getByRole('button', { name: 'Close Backup' }).click();
    await page.evaluate(() => window.finishRead());
    await openEditorMenu(page, 'Backup');
    // Closing disposes the controls and cancels its outstanding read.
    assert.equal(await page.getByRole('button', { name: 'Confirm Replace' }).count(), 0);
  } finally { await browser.close(); }
});

test('without Web Locks the editor fails closed and the published-view action stays available', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage(); await page.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
    await open(page); await page.getByRole('heading', { name: 'This tab is view-only' }).waitFor();
    assert.equal(await page.locator('aside.text-window').count(), 0);
    assert.equal(await page.evaluate(() => { const store = window.guardedStore(); return store.restoreBackup(store.getDraft(), { expectedGeneration: 0 }); }), false);
    await page.getByRole('button', { name: 'View published profile' }).click();
    await page.getByText('Published view requested').waitFor();
  } finally { await browser.close(); }
});

test('an existing free canvas adopts Bento cells in Studio and restores its original layers with Undo', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    page.setDefaultTimeout(10000);
    await page.route('**/*', request => request.request().url() === 'https://studio.example.invalid/red.png'
      ? request.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAANSURBVBhXY/jPwPAfAAUAAf+mXJtdAAAAAElFTkSuQmCC', 'base64') })
      : route(request));
    await page.goto(url + '&selection=1&firstCell=1');
    await editorMenu(page).waitFor();
    const activeId = await page.locator('.editor-menu-bar').getAttribute('data-document');
    const before = await page.evaluate(() => window.savedDraft());
    const choose = async (group, name) => (await openEditorMenu(page, group)).getByRole('menuitem', { name, exact: true }).click();
    const inspect = async native => {
      await page.waitForFunction(enabled => {
        const record = window.savedDraft();
        const content = record.workbenches?.find(item => item.id === record.activeId)?.content || record;
        return Boolean(content.composition) === enabled;
      }, native);
      const record = await page.evaluate(() => window.savedDraft());
      const content = record.workbenches?.find(item => item.id === record.activeId)?.content || record;
      const draft = native ? content.composition : content;
      assert.deepEqual(draft.texts, before.texts);
      assert.deepEqual(draft.imageModules, before.imageModules);
      assert.deepEqual(draft.workbench.texts, before.workbench.texts);
      assert.deepEqual(draft.workbench.imageModules, before.workbench.imageModules);
      assert.equal(await activeEditorDocument(page), activeId);
      return draft;
    };
    const draw = async () => {
      await page.mouse.move(760, 300); await page.mouse.down();
      await page.mouse.move(920, 480, { steps: 8 });
    };
    await choose('Canvas', 'Add cell'); await draw();
    await page.locator('.workbench-creation-ghost').waitFor();
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.deepEqual(await page.evaluate(() => window.savedDraft()), before);
    await page.getByRole('button', { name: 'Cell tool', exact: true }).click();
    await draw(); await page.mouse.up();
    const placed = await inspect(true);
    assert.equal(placed.cells.length, 1);
    const [cell] = placed.cells;
    assert.deepEqual(cell.members, []);
    const target = page.locator('[data-editor-cell-surface="' + cell.id + '"]');
    const source = page.locator('[data-image-module="image:gesture"] .image-module__canvas');
    await source.locator('[data-media-state=ready]').waitFor();
    const from = await source.boundingBox(), to = await target.boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
    await page.locator('[data-cell-drop]').waitFor(); await page.mouse.up();
    const current = () => page.evaluate(() => {
      const record = window.savedDraft();
      return record.workbenches?.find(item => item.id === record.activeId)?.content || record;
    });
    await page.waitForFunction(() => {
      const record = window.savedDraft();
      const content = record.workbenches?.find(item => item.id === record.activeId)?.content || record;
      return content.composition?.cells[0].members.includes('image:gesture');
    });
    const moved = (await current()).composition;
    assert.deepEqual(moved.imageModules, before.imageModules);
    assert.deepEqual(moved.workbench.texts, before.workbench.texts);
    assert.notDeepEqual(moved.workbench.imageModules[0].position, placed.workbench.imageModules[0].position);
    await choose('Edit', 'Undo');
    await page.waitForFunction(() => {
      const record = window.savedDraft();
      const content = record.workbenches?.find(item => item.id === record.activeId)?.content || record;
      return content.composition?.cells[0].members.length === 0;
    });
    assert.deepEqual(await inspect(true), placed);
    await choose('Edit', 'Undo'); await inspect(false);
    await page.reload(); await editorMenu(page).waitFor(); await inspect(false);
    assert.equal((await current()).composition, undefined);

    await choose('Canvas', 'Add cell'); await draw(); await page.mouse.up();
    const redrawn = await inspect(true);
    await choose('Edit', 'Undo'); await inspect(false);
    await choose('Edit', 'Redo'); assert.deepEqual(await inspect(true), redrawn);
    await page.reload(); await editorMenu(page).waitFor();
    assert.deepEqual(await inspect(true), redrawn);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

async function createStudioDocument(page, layout, name) {
  await editorCommand(page, 'Canvas', '+ New');
  const form = page.getByRole('dialog', { name: 'New composition' });
  await form.getByLabel('Starting layout').selectOption(layout);
  await form.getByLabel('Composition name').fill(name);
  await form.getByRole('button', { name: 'Create composition', exact: true }).click();
}

test('Studio creates one named Bento with free artwork and cell content, then renames and reopens it', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await open(page);
    await createStudioDocument(page, 'bento', 'With cells');
    const studio = page.locator('main[data-composition-editor]');
    await studio.waitFor();
    const active = () => page.evaluate(() => {
      const record = window.savedDraft();
      return record.workbenches.find(item => item.id === record.activeId);
    });
    const original = await active(); assert.ok(original.content.composition.cells.length > 1);
    await studio.focus(); await page.keyboard.press('r');
    const draw = await studio.evaluate(main => {
      for (let y = 160; y < innerHeight - 160; y += 20) for (let x = 320; x < innerWidth - 300; x += 20) {
        const node = document.elementFromPoint(x, y);
        if (node && main.contains(node) && !node.closest('button,aside,[data-editor-cell-surface],[data-workbench-window],.workbench-tool-dock') &&
          (node === main || node.closest('.workbench-camera,.workbench-canvas,.system-workflow__surfaces') || node.className === 'workbench-creation-surface')) return {x,y};
      }
      return null;
    });
    assert.ok(draw, 'the Studio provides an exposed surface for drawing free artwork');
    await page.mouse.move(draw.x, draw.y); await page.mouse.down();
    await page.mouse.move(draw.x + 120, draw.y + 90, { steps: 8 }); await page.mouse.up();
    await page.waitForFunction(before => {
      const record = window.savedDraft();
      return record.workbenches.find(item => item.id === record.activeId).content.composition.shapes.length > before;
    }, original.content.composition.shapes.length);
    const free = (await active()).content.composition.shapes.find(shape => !original.content.composition.shapes.some(cell => cell.id === shape.id));
    await studio.focus(); await page.keyboard.press('v');
    const cell = await page.locator('[data-editor-cell-surface]').evaluateAll(nodes => nodes.find(node => {
      const r = node.getBoundingClientRect();
      return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    })?.dataset.editorCellSurface);
    assert.ok(cell, 'a starter cell is reachable within the workspace');
    await page.locator('[data-editor-cell-surface="' + cell + '"]').click();
    await page.getByRole('button', { name: '+ Text', exact: true }).click();
    await page.getByRole('textbox', { name: 'Article text', exact: true }).fill('A closed loop');
    await studio.focus();
    await page.waitForFunction(() => JSON.stringify(window.savedDraft()).includes('A closed loop'));
    const mixed = (await active()).content.composition;
    assert.ok(mixed.shapes.some(shape => shape.id === free.id));
    assert.equal(mixed.cells.some(entry => entry.members.includes(free.id)), false);
    assert.ok(mixed.cells.find(entry => entry.id === cell).members.includes(mixed.texts[0].id));
    await editorCommand(page, 'Studio', 'Rename composition');
    const rename = page.getByRole('dialog', { name: 'Rename composition' });
    await rename.getByLabel('Composition name').fill('Mixed work');
    await rename.getByRole('button', { name: 'Save name' }).click();
    await editorCommand(page, 'Compositions', 'Workbench 1', 'menuitemcheckbox');
    await editorCommand(page, 'Compositions', 'Mixed work', 'menuitemcheckbox');
    await page.waitForFunction(id => window.savedDraft().activeId === id, original.id);
    const restored = await active();
    assert.equal(restored.id, original.id);
    assert.equal(restored.name, 'Mixed work');
    assert.deepEqual(restored.content.composition, mixed);
    await page.reload(); await studio.waitFor();
    assert.equal((await active()).id, original.id);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});


test('a newly created Canvas opens its full module tools and can undo the transition in Studio', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await open(page);
    await createStudioDocument(page, 'canvas', 'Module study');
    const native = page.locator('main[data-composition-editor]');
    await native.waitFor();
    const id = await activeEditorDocument(page);
    await editorCommand(page, 'Canvas', 'Use canvas modules');
    await native.waitFor({ state: 'detached' });
    assert.equal(await activeEditorDocument(page), id);
    const tools = await openEditorMenu(page, 'Tools');
    await tools.getByRole('menuitem', { name: 'Groups', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await editorCommand(page, 'Edit', 'Undo');
    await native.waitFor();
    assert.equal(await activeEditorDocument(page), id);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('workspace backup previews merge conflicts and exports the current revision before confirmation', async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage(); await open(page); await page.locator('aside.text-window').waitFor();
    const panel = await settings(page);
    const original = await page.evaluate(() => window.savedDraft());
    const incoming = structuredClone(original);
    incoming.texts[0].article.title = 'Imported article';
    await upload(panel, JSON.stringify({type:'inscape-private-workbench',version:1,createdAt:new Date().toISOString(),draft:incoming}));
    const download = page.waitForEvent('download');
    await panel.getByRole('button', {name:'Export current workspace first'}).click();
    const file = JSON.parse(await readFile(await (await download).path(), 'utf8'));
    assert.deepEqual(file.workspace.workbenches.workbenches[0].content.texts, original.texts);
    assert.deepEqual(file.workspace.workbenches.shared.identityPresentation, original.identityPresentation);
    await panel.getByLabel('Restore mode').selectOption('merge');
    await panel.getByText('conflicts (1)', {exact:true}).waitFor();
    assert.deepEqual(await page.evaluate(() => window.savedDraft()), original);
    await panel.getByRole('button', {name:'Confirm Merge'}).click();
    await page.waitForFunction(() => window.savedDraft()?.workbenches?.length === 2);
    const merged = await page.evaluate(() => window.savedDraft());
    assert.equal(merged.workbenches[0].content.texts[0].article.title,'Private draft');
    assert.equal(merged.workbenches[1].content.texts[0].article.title,'Imported article');
    await settings(page); await panel.getByText(/Changes since last export/).waitFor();
  } finally { await browser.close(); }
});
