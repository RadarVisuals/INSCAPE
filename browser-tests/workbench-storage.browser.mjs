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
async function settings(page) { await page.getByRole('button', { name: 'Settings', exact: true }).click(); return page.getByRole('region', { name: 'Workbench backup', exact: true }); }
const upload = (panel, source) => panel.getByLabel('Open Workbench backup', { exact: true }).setInputFiles({ name: 'workbench.json', mimeType: 'application/json', buffer: Buffer.from(source) });

test('two real tabs have one editor, separate profiles remain independent, and closing releases access', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const context = await browser.newContext(), a = await context.newPage(), b = await context.newPage();
    await open(a); await a.locator('.text-window').waitFor();
    await open(b); await b.getByRole('heading', { name: 'This tab is view-only' }).waitFor();
    await mkdir(output, { recursive: true });
    for (const width of [1440, 390]) { await b.setViewportSize({ width, height: 1000 }); await b.screenshot({ path: path.join(output, `view-only-${width}.png`) }); }
    assert.equal(await b.locator('.text-window').count(), 0);
    const refusal = await b.evaluate(() => { const s = window.guardedStore(), d = s.getDraft(); d.identityPresentation.alias = 'Rejected'; return { saved: s.commitCompletedOperation(d, { expectedGeneration: s.getGeneration() }), reason: s.getLastCommitFailure() }; });
    assert.deepEqual(refusal, { saved: false, reason: 'editor_unavailable' });
    const c = await context.newPage(); await open(c, `${url}&profile=0x${'2'.repeat(40)}`); await c.locator('.text-window').waitFor();
    await a.evaluate(() => { window.staleStore = window.guardedStore(); window.leaveEditor(); });
    assert.equal(await a.evaluate(() => window.staleStore.commitCompletedOperation(window.staleStore.getDraft(), { expectedGeneration: window.staleStore.getGeneration() })), false);
    await b.getByRole('button', { name: 'Try editing here' }).click(); await b.locator('.text-window').waitFor();
    await b.close();
    const d = await context.newPage(); await open(d); await d.locator('.text-window').waitFor();
    await mkdir(output, { recursive: true }); await writeFile(path.join(output, 'two-tabs.json'), JSON.stringify({ competingWrite: refusal, profileIsolation: true, staleWriteRejected: true, closeReleases: true }, null, 2));
  } finally { await browser.close(); }
});

for (const width of [1440, 390]) test(`full private backup downloads, validates, cancels, restores, and survives reload at ${width}px`, { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 } }); const errors = []; page.on('pageerror', e => errors.push(e.message));
    await open(page); await page.locator('.text-window').waitFor();
    let panel = await settings(page);
    const downloading = page.waitForEvent('download'); await panel.getByRole('button', { name: 'Download Workbench backup', exact: true }).click();
    const source = await readFile(await (await downloading).path(), 'utf8'), backup = JSON.parse(source);
    assert.equal(backup.draft.texts[0].visibility, 'PRIVATE'); assert.equal(backup.draft.texts[0].article.title, 'Private draft');
    const before = await page.evaluate(() => window.savedDraft());
    await upload(panel, '{broken'); await panel.getByText('Choose a valid INSCAPE Workbench JSON backup.').waitFor();
    await upload(panel, source); await panel.getByRole('button', { name: 'Cancel Workbench restore' }).click(); assert.deepEqual(await page.evaluate(() => window.savedDraft()), before);
    const foreign = structuredClone(backup); foreign.draft.profileAddress = `0x${'2'.repeat(40)}`;
    await upload(panel, JSON.stringify(foreign)); await panel.getByText('This backup belongs to a different Universal Profile.').waitFor();
    const restored = structuredClone(backup); restored.draft.texts[0].article.title = 'Restored private composition'; restored.draft.workbench.texts[0].window.left = 110;
    await upload(panel, JSON.stringify(restored));
    await mkdir(output, { recursive: true }); await panel.getByRole('button', { name: 'Replace Workbench with backup' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, `backup-confirm-${width}.png`) });
    await panel.getByRole('button', { name: 'Replace Workbench with backup' }).click();
    await page.waitForFunction(() => window.savedDraft().texts[0].article.title === 'Restored private composition');
    assert.deepEqual(await page.evaluate(() => window.savedDraft()), restored.draft);
    await page.reload(); await page.locator('.text-window').waitFor(); assert.deepEqual(await page.evaluate(() => window.savedDraft()), restored.draft);
    assert.ok(Math.abs((await page.locator('.text-window').boundingBox()).x - 110) < 1, 'the restored window position survives the old layout cache and reload');
    await page.screenshot({ path: path.join(output, `restored-${width}.png`) });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('an unpublished corrupt draft exposes backup recovery without deleting the corrupt record first', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage(); await open(page); await page.locator('.text-window').waitFor();
    const draft = await page.evaluate(() => window.savedDraft());
    await page.evaluate(async () => { const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js'); localStorage.setItem(systemWorkflowDraftKey(window.fixtureProfile), '{broken'); });
    await page.reload(); await page.getByRole('heading', { name: 'Local workspace could not be opened' }).waitFor();
    assert.equal(await page.evaluate(async () => { const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js'); return localStorage.getItem(systemWorkflowDraftKey(window.fixtureProfile)); }), '{broken');
    const panel = page.getByRole('region', { name: 'Workbench backup', exact: true });
    await upload(panel, JSON.stringify({ type: 'inscape-private-workbench', version: 1, createdAt: new Date().toISOString(), draft }));
    await panel.getByRole('button', { name: 'Replace Workbench with backup' }).click();
    await page.locator('.text-window').waitFor(); assert.deepEqual(await page.evaluate(() => window.savedDraft()), draft);
  } finally { await browser.close(); }
});

test('restore errors retain saved bytes and a delayed file cannot replace subsequently edited work', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage(); await open(page); await page.locator('.text-window').waitFor();
    let panel = await settings(page);
    const original = await page.evaluate(() => window.savedDraft());
    const changed = structuredClone(original); changed.texts[0].article.title = 'Backup replacement';
    const source = JSON.stringify({ type: 'inscape-private-workbench', version: 1, createdAt: new Date().toISOString(), draft: changed });
    await upload(panel, source);
    await page.evaluate(() => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function(key, value) { if (key.startsWith('inscape.system-workflow-draft.')) throw new DOMException('Full', 'QuotaExceededError'); return set.call(this, key, value); }; window.restoreWrites = () => { Storage.prototype.setItem = set; }; });
    await panel.getByRole('button', { name: 'Replace Workbench with backup' }).click();
    await panel.getByText(/The backup was not restored/).waitFor(); assert.deepEqual(await page.evaluate(() => window.savedDraft()), original);
    await page.evaluate(() => window.restoreWrites());
    // A visible concurrent change must still be refused, even with the editor lock.
    await page.evaluate(async () => { const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js'); const draft = window.savedDraft(); draft.identityPresentation.alias = 'Externally changed'; localStorage.setItem(systemWorkflowDraftKey(window.fixtureProfile), JSON.stringify(draft)); });
    await panel.getByRole('button', { name: 'Replace Workbench with backup' }).click();
    assert.equal(await page.evaluate(() => window.savedDraft().identityPresentation.alias), 'Externally changed');
    assert.equal(await page.evaluate(() => window.savedDraft().texts[0].article.title), 'Private draft');
    await page.reload(); await page.locator('.text-window').waitFor(); panel = await settings(page);
    await page.evaluate(() => { const text = File.prototype.text; File.prototype.text = async function() { const value = await text.call(this); await new Promise(resolve => { window.finishRead = resolve; }); return value; }; });
    await upload(panel, source); await page.waitForFunction(() => Boolean(window.finishRead));
    await page.getByRole('button', { name: 'Close Settings' }).click();
    await page.evaluate(() => window.finishRead());
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    // Closing disposes the controls and cancels its outstanding read.
    assert.equal(await page.getByRole('button', { name: 'Replace Workbench with backup' }).count(), 0);
  } finally { await browser.close(); }
});

test('without Web Locks the editor fails closed and the published-view action stays available', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage(); await page.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
    await open(page); await page.getByRole('heading', { name: 'This tab is view-only' }).waitFor();
    assert.equal(await page.locator('.text-window').count(), 0);
    assert.equal(await page.evaluate(() => { const store = window.guardedStore(); return store.restoreBackup(store.getDraft(), { expectedGeneration: 0 }); }), false);
    await page.getByRole('button', { name: 'View published workspace' }).click();
    await page.getByText('Published view requested').waitFor();
  } finally { await browser.close(); }
});
