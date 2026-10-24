import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { pointerAction, r12Cases } from './fixtures/r12-pointer.mjs';

const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';
const address = `0x${'1'.repeat(40)}`;
const hash = `0x${'a'.repeat(64)}`;
const key = `inscape:publication:v1:42:${address}`;
const record = { version: 1, profileAddress: address, chainId: 42,
  artifactHash: `0x${'b'.repeat(64)}`, uri: 'ipfs://QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQw',
  transactionHash: hash, status: 'SUBMITTED', createdAt: 1 };
const url = `${process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173'}/browser-tests/publication-recovery-fixture.html`;

test('publication recovery survives reload, stays bounded, and never writes during retries or profile switches', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const { theme, width, height } of [{ theme: 'paper', width: 1440, height: 800 }, { theme: 'paper', width: 390, height: 800 }, ...r12Cases]) {
      const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
      const errors = []; const methods = [];
      page.on('pageerror', (error) => errors.push(error.message));
      let reverted = false;
      let gate = null;
      await page.route('https://**/*', async route => {
        const body = route.request().postDataJSON();
        if (!body?.method) return route.abort();
        methods.push(body.method);
        if (gate) await gate;
        const receipt = reverted ? { transactionHash: hash, status: '0x0', blockHash: `0x${'c'.repeat(64)}`,
          blockNumber: '0x1', transactionIndex: '0x0', from: address, to: address, cumulativeGasUsed: '0x1', gasUsed: '0x1',
          effectiveGasPrice: '0x1', logs: [], logsBloom: `0x${'0'.repeat(512)}`, type: '0x2', contractAddress: null } : null;
        return route.fulfill({ json: { jsonrpc: '2.0', id: body.id, result: receipt } });
      });
      await page.goto(`${url}?theme=${theme}`);
      await page.evaluate(({ key, record }) => localStorage.setItem(key, JSON.stringify(record)), { key, record });
      await page.reload();
      const recovery = page.locator('.owner-lattice-publication-rack__recovery');
      await page.getByText('Confirmation is not available yet.', { exact: false }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Prepare publication', exact: true }).isDisabled(), true);
      await pointerAction(page, page.getByRole('button', { name: 'CHECK AGAIN', exact: true }));
      await page.getByText('Confirmation is not available yet.', { exact: false }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'CHECK AGAIN', exact: true }).evaluate(el => getComputedStyle(el).fontSize), '11px');
      await mkdir(output, { recursive: true });
      await page.screenshot({ path: `${output}/publication-recovery-${theme}-${width}x${height}.png` });
      const bounds = await page.locator('.owner-lattice-publication-rack').boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1 && bounds.y >= 0 && bounds.y + bounds.height <= height + 1);
      assert.equal(await recovery.evaluate(el => el.scrollWidth <= el.clientWidth), true);
      let release;
      gate = new Promise(resolve => { release = resolve; });
      await pointerAction(page, page.getByRole('button', { name: 'CHECK AGAIN', exact: true }));
      await page.getByText('Checking the previous publication.', { exact: false }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'CHECK AGAIN', exact: true }).isDisabled(), true);
      await page.evaluate(() => window.recoveryFixture.setAddress(`0x${'2'.repeat(40)}`));
      await recovery.waitFor({ state: 'detached' });
      release(); gate = null;
      assert.equal(await page.getByRole('button', { name: 'Prepare publication', exact: true }).isEnabled(), true);
      await page.evaluate(() => window.recoveryFixture.setAddress(`0x${'1'.repeat(40)}`));
      await page.getByText('Confirmation is not available yet.', { exact: false }).waitFor();
      reverted = true;
      await pointerAction(page, page.getByRole('button', { name: 'CHECK AGAIN', exact: true }));
      await page.getByRole('button', { name: 'ACKNOWLEDGE RESULT', exact: true }).waitFor();
      await page.screenshot({ path: `${output}/publication-reverted-${theme}-${width}x${height}.png` });
      await pointerAction(page, page.getByRole('button', { name: 'ACKNOWLEDGE RESULT', exact: true }));
      await recovery.waitFor({ state: 'detached' });
      assert.equal(await page.evaluate(key => localStorage.getItem(key), key), null);
      assert.ok(methods.length >= 3);
      assert.deepEqual([...new Set(methods)], ['eth_getTransactionReceipt']);
      assert.deepEqual(errors, []);
      // The origin-wide lock keeps two live tabs from reserving simultaneously.
      assert.deepEqual(await page.evaluate(async (address) => {
        let release; let started;
        const ready = new Promise(resolve => { started = resolve; });
        const first = window.recoveryFixture.journal.runExclusive(address, async () => {
          started(); await new Promise(resolve => { release = resolve; });
        });
        await ready;
        let blocked = false;
        try { await window.recoveryFixture.journal.runExclusive(address, () => { throw new Error('must not enter'); }); }
        catch (error) { blocked = error.message.includes('Another window'); }
        release(); await first;
        return { blocked };
      }, address), { blocked: true });
      await page.close();
    }
  } finally { await browser.close(); }
});
