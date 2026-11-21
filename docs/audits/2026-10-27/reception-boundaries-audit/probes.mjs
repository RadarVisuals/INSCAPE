// Evidence probes assert the observed defect, not the desired corrected behavior.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../../../../scripts/browserEnvironment.mjs';
const out = dirname(fileURLToPath(import.meta.url));
const root = resolve(out, '../../../..');
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, open: false } });
await mkdir(resolve(out, 'probes'), { recursive: true });
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const url = origin + '/docs/audits/2026-10-27/reception-boundaries-audit/fixture.html';
const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
const results = [];
const run = async (name, fn) => {
  if (process.argv[2] && process.argv[2] !== name) return;
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const errors = []; context.on('page', page => page.on('pageerror', e => errors.push(e.message)));
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  try { const result = await fn(context); results.push({ name, ...result, pageErrors: errors }); }
  catch (error) { results.push({ name, probeFailure: error.stack, pageErrors: errors }); process.exitCode = 1; }
  finally { await context.close(); console.log(JSON.stringify(results.at(-1))); await writeFile(resolve(out, process.argv[2] ? process.argv[2] + '.json' : 'probe-results.json'), JSON.stringify(results, null, 2)); }
};
const open = async context => { const page = await context.newPage(); await page.goto(url); await page.getByText('LOCAL A', { exact: true }).waitFor(); return page; };
try {
  await run('authored-text-and-chrome', async context => {
    const page = await open(context);
    await page.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    await page.getByRole('region', { name: 'Region 2 · text', exact: true }).click();
    await page.getByRole('textbox', { name: 'Article title', exact: true }).waitFor();
    const metrics = async () => page.locator('.text-document-title').evaluate(el => {
      const s = getComputedStyle(el); return { tag: el.tagName, color: s.color, font: s.font, border: s.border, padding: s.padding, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height };
    });
    const editing = await metrics();
    await page.screenshot({ path: resolve(out, 'probes/text-editor-chrome.png') });
    await page.getByRole('button', { name: 'Preview', exact: true }).click();
    await page.locator('h1.text-document-title').waitFor();
    const preview = await metrics();
    await page.screenshot({ path: resolve(out, 'probes/text-reader-chrome.png') });
    await page.getByRole('button', { name: 'Back to editing', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Page settings', exact: true }).click();
    const targets = await page.locator('.reception-editor-header button, .workbench-tool-panel-close, input[aria-label="Brand name"]').evaluateAll(nodes => nodes.map(el => ({ label: el.getAttribute('aria-label') || el.textContent, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height, fontSize: getComputedStyle(el).fontSize })));
    await page.screenshot({ path: resolve(out, 'probes/mobile-control-sizes.png') });
    return { editing, preview, mobileTargets: targets };
  });
  await run('local-reader-depends-on-publication', async context => {
    const page = await open(context); const statuses = [];
    for (const status of ['UNAVAILABLE', 'ERROR', 'INVALID']) {
      await page.evaluate(s => window.auditFixture.setStatus(s), status);
      await page.getByRole('main', { name: 'Published profile status' }).waitFor();
      assert.equal(await page.locator('.reception-canvas').count(), 0);
      statuses.push({ status, canonicalBrand: await page.evaluate(() => window.auditFixture.saved().reception.branding.name), receptionVisible: false });
    }
    await page.screenshot({ path: resolve(out, 'probes/local-draft-blocked-by-public-state.png') });
    return { confirmed: true, statuses };
  });
  await run('reader-refresh-after-another-editor', async context => {
    const reader = await open(context), editor = await open(context);
    await editor.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    await editor.getByRole('button', { name: 'Page settings', exact: true }).click();
    await editor.getByRole('textbox', { name: 'Brand name', exact: true }).fill('LOCAL B');
    await editor.getByRole('button', { name: 'Done', exact: true }).click();
    await editor.getByText('LOCAL B', { exact: true }).waitFor();
    await reader.bringToFront();
    assert.equal(await reader.evaluate(() => window.auditFixture.saved().reception.branding.name), 'LOCAL B');
    assert.equal(await reader.locator('.reception-brand').innerText(), 'LOCAL A');
    await reader.screenshot({ path: resolve(out, 'probes/stale-owner-reader.png') });
    await reader.reload(); await reader.getByText('LOCAL B', { exact: true }).waitFor();
    return { confirmed: true, stored: 'LOCAL B', otherReaderBeforeReload: 'LOCAL A', readerAfterReload: 'LOCAL B' };
  });
  await run('backup-recovery-reader-refresh', async context => {
    const page = await open(context);
    const backup = await page.evaluate(() => window.auditFixture.backup);
    await page.evaluate(() => { window.auditFixture.corrupt(); window.auditFixture.remount(); });
    await page.getByText('Your local Reception could not be read.', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    await page.getByLabel('Open Workbench backup', { exact: true }).setInputFiles({ name: 'synthetic-backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
    await page.getByRole('button', { name: 'Replace Workbench with backup', exact: true }).click();
    await page.getByText('PUBLIC ONLY', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.auditFixture.saved().reception.branding.name), 'RESTORED LOCAL');
    assert.equal(await page.getByText('Your local Reception could not be read.', { exact: false }).count(), 1);
    await page.screenshot({ path: resolve(out, 'probes/recovery-still-shows-error.png') });
    await page.reload(); await page.getByText('RESTORED LOCAL', { exact: true }).waitFor();
    return { confirmed: true, stored: 'RESTORED LOCAL', visibleAfterRestore: 'PUBLIC ONLY with obsolete recovery alert', afterReload: 'RESTORED LOCAL' };
  });
  await run('panel-keyboard-focus', async context => {
    const page = await open(context);
    await page.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    const trigger = page.getByRole('button', { name: 'Page settings', exact: true });
    await trigger.focus(); await trigger.press('Enter');
    const close = page.getByRole('button', { name: 'Close Page settings', exact: true });
    await close.focus(); await close.press('Enter');
    await close.waitFor({ state: 'detached' });
    const active = await page.evaluate(() => ({ tag: document.activeElement.tagName, label: document.activeElement.getAttribute('aria-label') }));
    await page.screenshot({ path: resolve(out, 'probes/panel-focus-after-close.png') });
    return { observed: active, expected: 'Page settings trigger' };
  });
  await run('two-tabs-lease-and-authority-loss', async context => {
    const first = await open(context), second = await open(context);
    await first.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    await first.getByRole('button', { name: 'Done', exact: true }).waitFor();
    await second.getByRole('button', { name: 'Edit Reception', exact: true }).click();
    await second.getByRole('heading', { name: 'This tab is view-only', exact: true }).waitFor();
    await first.getByRole('button', { name: 'Done', exact: true }).click();
    await second.getByRole('button', { name: 'Try editing here', exact: true }).click();
    await second.getByRole('button', { name: 'Done', exact: true }).waitFor();
    await second.evaluate(() => window.auditFixture.setOwner(false));
    await second.getByText('PUBLIC ONLY', { exact: true }).waitFor();
    assert.equal(await second.locator('[data-reception-editor]').count(), 0);
    assert.equal(await second.getByText('LOCAL ARTICLE', { exact: true }).count(), 0);
    return { passed: true, busyBlocksSecondEditor: true, doneReleasesLease: true, authorityLossRemovesLocalReaderAndTools: true };
  });
} finally { await browser.close(); await server.close(); }
