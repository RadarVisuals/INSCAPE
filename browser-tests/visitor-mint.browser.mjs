import assert from 'node:assert/strict';
import { access, mkdir } from 'node:fs/promises';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { CREATURE_URL } from '../prototypes/visitor-mint/simulation.js';

const origin = process.env.INSCAPE_MINT_ROOT || 'http://127.0.0.1:5173';
const executablePath = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const url = `${origin}/prototypes/visitor-mint/`;
async function open(t, viewport = { width: 1440, height: 1000 }) {
  const browser = await chromium.launch({ executablePath, headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, [], 'No browser runtime errors'));
  await page.addInitScript(() => {
    window.walletRequests = 0;
    window.ethereum = { request() { window.walletRequests++; throw new Error('A prototype must not request a wallet'); } };
  });
  // Use the exact already-downloaded artwork when present; otherwise use its
  // public source. This optional cache is not required by the prototype.
  const cached = '.browser-test-runtime/creature-source.svg';
  if (await access(cached).then(() => true, () => false)) {
    await page.route(CREATURE_URL, route => route.fulfill({ path: cached, contentType: 'image/svg+xml' }));
  }
  await page.goto(url);
  await page.getByRole('button', { name: 'Connect demo profile', exact: true }).waitFor();
  return page;
}
async function startMint(page) {
  await page.getByRole('button', { name: 'Connect demo profile', exact: true }).click();
  await page.getByRole('button', { name: 'Mint one creature', exact: true }).click();
  await page.getByRole('dialog', { name: 'Simulated wallet confirmation' }).waitFor();
}

test('visitor can cancel by keyboard, recover focus and confirm a simulated mint', { timeout: 40000 }, async t => {
  const page = await open(t);
  await startMint(page);
  await page.keyboard.press('Escape');
  await page.getByText('Confirmation cancelled. Nothing was submitted.').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Mint one creature', exact: true }).evaluate(node => node === document.activeElement), true);
  await page.getByRole('button', { name: 'Mint one creature', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm simulation', exact: true }).click();
  await page.getByText('Simulation confirmed', { exact: true }).waitFor();
  await page.getByText('24 / 25 remaining', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => walletRequests), 0);
  await page.getByLabel('Demo visitor', { exact: true }).selectOption('visitor-b');
  await page.getByRole('button', { name: 'Mint one creature', exact: true }).waitFor();
  assert.equal(await page.getByText('Simulation confirmed', { exact: true }).count(), 0);
});

test('interrupted submission recovers on reload and remains isolated from INSCAPE drafts', { timeout: 40000 }, async t => {
  const page = await open(t);
  await page.evaluate(() => localStorage.setItem('inscape:test-preserve-draft', 'untouched'));
  await page.getByLabel('Try a scenario').selectOption('interrupted');
  await startMint(page);
  await page.getByRole('button', { name: 'Confirm simulation', exact: true }).click();
  await page.getByText('Check your previous mint', { exact: true }).waitFor();
  await page.reload();
  await page.getByLabel('Try a scenario').selectOption('interrupted');
  await page.getByRole('button', { name: 'Connect demo profile', exact: true }).click();
  await page.getByRole('button', { name: 'Check mint status', exact: true }).waitFor();
  await page.waitForTimeout(1700);
  await page.getByRole('button', { name: 'Check mint status', exact: true }).click();
  await page.getByText('Simulation confirmed', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('inscape:prototype:visitor-mint:ledger:v1')).length), 1);
  await page.getByRole('button', { name: 'Reset preview', exact: true }).click();
  await page.getByRole('button', { name: 'Connect demo profile', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('inscape:test-preserve-draft')), 'untouched');
});

test('free, unavailable, paused, sold out and changed-price states have distinct actions', { timeout: 40000 }, async t => {
  const page = await open(t);
  for (const [scenario, label] of [['paused', 'Mint paused'], ['sold-out', 'Sold out']]) {
    await page.getByLabel('Try a scenario').selectOption(scenario);
    await page.getByRole('button', { name: label, exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: label, exact: true }).isDisabled(), true);
  }
  await page.getByLabel('Try a scenario').selectOption('unavailable');
  await page.getByRole('button', { name: 'Retry mint details', exact: true }).click();
  await page.getByText('Mint details or local recovery could not be read. Retry to check again.').waitFor();
  await page.getByLabel('Try a scenario').selectOption('free');
  await page.getByText('Free', { exact: true }).waitFor();
  await page.getByText('Shown by wallet before approval', { exact: true }).waitFor();
  await page.getByLabel('Try a scenario').selectOption('changed');
  await page.getByRole('button', { name: 'Connect demo profile', exact: true }).click();
  await page.getByRole('button', { name: 'Mint one creature', exact: true }).click();
  await page.getByText('The sale changed. Review the latest details before continuing.').waitFor();
  assert.equal(await page.getByRole('dialog').count(), 0);
  await page.getByText('3 LYX', { exact: true }).waitFor();
});

test('wide and narrow previews contain their content and confirmation dialog', { timeout: 50000 }, async t => {
  const page = await open(t);
  await mkdir('.browser-test-runtime', { recursive: true });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `.browser-test-runtime/visitor-mint-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 720 });
  await startMint(page);
  const bounds = await page.getByRole('dialog').boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390 && bounds.y >= 0 && bounds.y + bounds.height <= 720);
  await page.screenshot({ path: '.browser-test-runtime/visitor-mint-confirmation.png' });
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.closest('dialog') !== null), true);
});
