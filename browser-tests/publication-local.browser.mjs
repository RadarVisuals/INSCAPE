import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { mountPublicationBoundary } from './fixtures/publication-boundary.mjs';
import { publishedCanvasEntries, publishedCompositionEntries } from '../src/profileDocument/domain/publishedCanvases.js';
import { DEVELOPMENT_PUBLICATION_SERVICE } from '../src/profileDocument/domain/publicationOrigin.js';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
for (const width of [1440, 390]) test(`local publication prepares 30 canvases with overlapping asset inventories (${width}px)`, { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const state = await mountPublicationBoundary(page, origin, null, 'carbon', true);
    const rack = page.getByRole('complementary', { name: 'Publish profile' });
    assert.ok(await page.evaluate(() => window.publicationBoundary.referenceRecordCount) > 0, 'the reference reader contains the same assets as the current canvas');
    await rack.getByRole('button', { name: 'Select all changed compositions' }).click();
    assert.equal(await rack.getByText(/Duplicate production asset record/).count(), 0);
    const work = rack.getByRole('group', { name: 'Canvas 2', exact: true });
    await work.getByRole('checkbox', { name: 'Profile', exact: true }).check();
    await work.getByRole('checkbox', { name: 'Gallery', exact: true }).uncheck();
    const both = rack.getByRole('group', { name: 'Canvas 3', exact: true });
    await both.getByRole('checkbox', { name: 'Profile', exact: true }).check();
    const prepare = rack.getByRole('button', { name: 'Prepare publication', exact: true });
    assert.equal(await prepare.isEnabled(), true);
    await prepare.click();
    const makePublic = rack.getByRole('button', { name: 'Make presentation public', exact: true });
    await makePublic.waitFor();
    assert.equal(state.uploads, 0, 'preparation does not upload');
    assert.equal(state.requests.length, 0);
    await makePublic.click();
    await rack.getByRole('button', { name: 'Publish to profile', exact: true }).waitFor();
    assert.equal(state.uploads, 1);
    assert.equal(state.writes, 0, 'upload does not publish an on-chain pointer');
    const document = JSON.parse(state.bytes), entries = publishedCanvasEntries(document);
    assert.equal(entries.length, 30);
    assert.deepEqual(publishedCompositionEntries(document, 'profile').map(item => item.name), ['Canvas 2', 'Canvas 3']);
    assert.deepEqual(publishedCompositionEntries(document, 'gallery').map(item => item.id),
      entries.filter(item => item.name !== 'Canvas 2').map(item => item.id));
    assert.equal(new Set(entries.map(item => item.id)).size, 30);
    for (const entry of entries) {
      assert.deepEqual(entry.content.imageModules.map(image => image.artwork.asset.name), ['ABYSSAL STUDY', 'MOUNTAIN SIGNAL II']);
    }
    assert.ok(state.requests.filter(request => request.method === 'POST').every(request => new URL(request.url).origin === DEVELOPMENT_PUBLICATION_SERVICE && request.origin === origin));
    assert.equal(await rack.evaluate(node => node.scrollWidth <= node.clientWidth), true);
    const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime/publication-local';
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: join(output, `publication-local-${width}.png`) });
    assert.deepEqual(errors, []);
    await page.close();
  } finally { await browser.close(); }
});
