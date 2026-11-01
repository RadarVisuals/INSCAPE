import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { encodeAbiParameters, keccak256, toBytes, toFunctionSelector } from 'viem';
import { encodeDataSourceWithHash } from '@erc725/erc725.js';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5180';
const source = 'https://keepers.inscape.test/prepared.svg';
const scriptUrl = 'https://keepers.inscape.test/keeper-dialogue.v1.txt';
const contract = '0x611d3df50a3d930fba0a1f951e9d44bd9d3aea21', tokenId = `0x${'0'.repeat(63)}4`;
const script = await readFile(new URL('./fixtures/keeper-dialogue.v1.txt', import.meta.url), 'utf8');
const hash = text => ({ method: 'keccak256(bytes)', data: keccak256(toBytes(text)) });
const metadata = JSON.stringify({ LSP4Metadata: { assets: [{ url: scriptUrl, fileType: 'text/plain', verification: hash(script) }] } });
const pointer = encodeDataSourceWithHash(hash(metadata), 'https://keepers.inscape.test/metadata.json');
const emptyMetadata = '{"LSP4Metadata":{"assets":[]}}';
const emptyPointer = encodeDataSourceWithHash(hash(emptyMetadata), 'https://keepers.inscape.test/metadata.json');
const launch = () => chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });

async function mount(page, { visitor = false, state = {} } = {}) {
  await mountTextToolsFixture(page, origin, { visitor, beforeImports: async () => {
    await page.route(source, route => route.fulfill({ contentType: 'image/svg+xml', path: fileURLToPath(new URL('./fixtures/keeper-layered.svg', import.meta.url)) }));
    await page.route('https://rpc.mainnet.lukso.network/**', route => {
      const request = route.request().postDataJSON();
      state.reads = (state.reads || 0) + 1;
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ jsonrpc: '2.0', id: request.id,
        result: encodeAbiParameters([{ type: 'bytes' }], [request.params?.[0]?.data?.startsWith(toFunctionSelector('getData(bytes32)')) ? '0x' : state.empty ? emptyPointer : pointer]) }) });
    });
    await page.route('https://keepers.inscape.test/metadata.json', route => route.fulfill({ contentType: 'application/json', body: state.empty ? emptyMetadata : metadata }));
    await page.route(scriptUrl, async route => {
      state.scriptReads = (state.scriptReads || 0) + 1;
      await state.hold;
      return route.fulfill({ contentType: 'text/plain', status: state.fail ? 503 : 200, body: state.fail ? 'unavailable' : script });
    });
  } });
}

async function seed(page, state = {}) {
  await mount(page, { state });
  await page.evaluate(async ({ source, contract, tokenId }) => {
    const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    const { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const { resolveLibraryImageAsset } = await import('/src/library/resolveLibraryImageAsset.js');
    const id = `42:${contract}:${tokenId}`;
    const asset = await resolveLibraryImageAsset({ ...OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0], id, stableAssetId: id,
      contractAddress: contract, tokenId, selectedMedia: { url: source, width: 2048, height: 2048 } });
    const draft = window.savedDraft();
    draft.keeperDocks = [{ id: 'keeper:speaker', name: 'Swimming Keeper', asset, faces: 'right', movement: 'swim', size: 384, visibility: 'PUBLIC' }];
    draft.workbench.keeperDocks = [{ id: 'keeper:speaker', position: { left: 600, top: 280 } }];
    localStorage.setItem(systemWorkflowDraftKey(draft.profileAddress), JSON.stringify(draft));
  }, { source, contract, tokenId });
  await page.reload(); await mount(page, { state });
  await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
  await page.getByRole('button', { name: 'Release Keeper', exact: true }).click();
}
const talk = async page => {
  await page.getByRole('button', { name: 'Talk to Swimming Keeper', exact: true }).focus();
  await page.keyboard.press('Enter');
};

test('head opens the real dialogue, replies branch, swimming pauses and resumes, and publication shares the player', { timeout: 90000 }, async () => {
  await mkdir('.browser-test-runtime', { recursive: true });
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const state = {};
    await seed(page, state);
    assert.equal(state.scriptReads || 0, 0, 'dialogue loads on interaction');
    const saved = await page.evaluate(() => window.savedDraft());
    await page.mouse.click(1100, 650); await page.waitForTimeout(180); await talk(page);
    const bubble = page.getByRole('dialog', { name: 'Swimming Keeper', exact: true });
    await bubble.getByText('Oh. You can see me.', { exact: false }).waitFor();
    const position = () => page.locator('.keeper-roamer').evaluate(n => n.getBoundingClientRect().x);
    const x = await position(); await page.waitForTimeout(250); assert.ok(Math.abs(await position() - x) < .01);
    await page.screenshot({ path: '.browser-test-runtime/keeper-dialogue-wide.png' });
    await bubble.getByRole('button', { name: 'What exactly are you?', exact: true }).click();
    await bubble.getByText('A Keeper. Small jurisdiction.', { exact: false }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await bubble.count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Talk to Swimming Keeper', exact: true }).evaluate(n => n === document.activeElement), true);
    await page.waitForFunction(() => document.querySelector('.keeper-roamer').getBoundingClientRect().x > 1095);
    assert.deepEqual(await page.evaluate(() => window.savedDraft()), saved, 'conversation is temporary');
    await page.getByRole('button', { name: 'Talk to Swimming Keeper', exact: true }).click({ force: true });
    await bubble.getByText('Oh. You can see me.', { exact: false }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(120);
    const rect = await bubble.boundingBox();
    assert.ok(rect.x >= 0 && rect.x + rect.width <= 390 && rect.y >= 0 && rect.y + rect.height <= 844);
    await page.screenshot({ path: '.browser-test-runtime/keeper-dialogue-narrow.png' });
    await bubble.getByRole('button', { name: 'Close conversation' }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await mount(page, { visitor: true, state });
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).click(); await talk(page);
    await bubble.getByText('Oh. You can see me.', { exact: false }).waitFor();
    await page.screenshot({ path: '.browser-test-runtime/keeper-dialogue-visitor.png' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('failed attachment has a working Retry; recall closes speech; reduced motion remains interactive', { timeout: 60000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const state = { fail: true };
    await seed(page, state); await talk(page);
    const bubble = page.getByRole('dialog', { name: 'Swimming Keeper', exact: true });
    await bubble.getByRole('button', { name: 'Retry dialogue' }).waitFor();
    state.fail = false;
    await bubble.getByRole('button', { name: 'Retry dialogue' }).click();
    await bubble.getByText('Oh. You can see me.', { exact: false }).waitFor();
    const transforms = () => page.locator('.keeper-rig__part').evaluateAll(nodes => nodes.map(n => n.style.transform));
    const before = await transforms(); await page.waitForTimeout(150); assert.deepEqual(await transforms(), before);
    await page.getByRole('button', { name: 'Return Keeper', exact: true }).click();
    assert.equal(await bubble.count(), 0);
    assert.ok(state.scriptReads >= 2);
  } finally { await browser.close(); }
});

test('closing cancels a pending conversation and an empty token can be checked again after adding dialogue', { timeout: 60000 }, async () => {
  const browser = await launch();
  let release;
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const state = { hold: new Promise(resolve => { release = resolve; }) };
    await seed(page, state); await talk(page);
    const bubble = page.getByRole('dialog', { name: 'Swimming Keeper', exact: true });
    await bubble.getByText('One moment…').waitFor();
    await page.waitForRequest(scriptUrl);
    await bubble.getByRole('button', { name: 'Close conversation' }).click();
    release(); state.hold = null;
    await page.waitForTimeout(100);
    assert.equal(await bubble.count(), 0, 'late content cannot reopen the panel');
    state.empty = true; await talk(page);
    await bubble.getByText('This character has no attached Keeper dialogue yet.').waitFor();
    state.empty = false;
    await bubble.getByRole('button', { name: 'Check again' }).click();
    await bubble.getByText('Oh. You can see me.', { exact: false }).waitFor();
    assert.deepEqual(errors, []);
  } finally { release?.(); await browser.close(); }
});
