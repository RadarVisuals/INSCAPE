import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5301';
const output = process.env.INSCAPE_SCREENSHOT_DIR || 'output/reception-card';
const browserPath = process.env.BROWSER_PATH || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe';
const url = origin + '/browser-tests/profile-overview-fixture.html?view=0x' + '1'.repeat(40) + '&card=1';
const bounds = locator => locator.evaluate(node => { const r = node.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
const routeFixture = route => new URL(route.request().url()).origin === origin ? route.continue()
  : route.request().url() === 'https://reception-card.invalid/portrait.webp'
    ? route.fulfill({ contentType: 'image/webp', path: 'public/assets/actors/skull_reaper/full.webp' }) : route.abort();

for (const width of [1440, 390]) test(`reception card shares Identity and keeps expansion and Lift inside one frame at ${width}`, { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserPath, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', routeFixture);
    await page.goto(url);
    await page.locator('.identity-module__clouds[data-shader="ready"]').waitFor();
    await page.locator('.profile-overview__work--image').first().locator('[data-media-state="ready"]').waitFor();
    const snapshot = await page.evaluate(() => JSON.stringify(window.__overviewPublication));
    const stage = page.locator('[data-bento-stage]'), initial = await bounds(stage);
    const cloud = await page.locator('.identity-module__clouds').elementHandle();
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: output + `/card-${width}-compact.png` });
    await page.getByRole('button', { name: 'Expand INSCAPE details', exact: true }).click();
    await page.getByText('Underneath', { exact: true }).waitFor();
    await page.waitForTimeout(500);
    assert.deepEqual(await bounds(stage), initial);
    assert.equal(await page.locator('.profile-overview__gallery').getAttribute('inert'), '');
    assert.equal(await cloud.evaluate(node => node === document.querySelector('.identity-module__clouds')), true);
    await page.screenshot({ path: output + `/card-${width}-profile.png` });
    await page.getByRole('button', { name: 'Expand artwork', exact: true }).click();
    await page.waitForTimeout(500);
    assert.deepEqual(await bounds(stage), initial);
    assert.equal(await page.locator('.identity-module__extension').isVisible(), false);
    assert.equal(await page.getByRole('button', { name: 'Collapse artwork', exact: true }).getAttribute('aria-expanded'), 'true');
    await page.screenshot({ path: output + `/card-${width}-artwork.png` });
    await page.getByRole('button', { name: 'Collapse artwork', exact: true }).click();
    await page.waitForTimeout(500);
    const rail = page.getByRole('region', { name: 'Published artwork carousel', includeHidden: true });
    await rail.focus(); await page.keyboard.press('End'); await page.waitForTimeout(450);
    assert.ok(await rail.evaluate(node => node.scrollLeft) > 0);
    const svgCard = page.getByRole('link', { name: 'Open Artwork 16', exact: true });
    await svgCard.focus(); await page.keyboard.press('Enter');
    await page.getByRole('dialog', { name: 'Expanded work' }).waitFor();
    await page.waitForFunction(() => Number(document.querySelector('.bento-stage__expansion')?.style.getPropertyValue('--inspection-lift-progress')) === 1);
    assert.deepEqual(await bounds(stage), initial);
    await page.screenshot({ path: output + `/card-${width}-inspection.png` });
    await page.getByRole('button', { name: 'Return to card', exact: true }).click();
    await page.getByRole('dialog', { name: 'Expanded work' }).waitFor({ state: 'detached' });
    assert.equal(await svgCard.evaluate(node => node === document.activeElement), true);
    assert.equal(await page.evaluate(() => JSON.stringify(window.__overviewPublication)), snapshot);
    assert.ok(await page.locator('.profile-overview').evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('mouse carousel drag coasts, suppresses activation and cancels when expansion changes', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserPath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.route('**/*', routeFixture);
    await page.goto(url);
    const rail = page.getByRole('region', { name: 'Published artwork carousel', includeHidden: true });
    await rail.waitFor();
    await page.locator('.profile-overview__work--image').first().locator('[data-media-state="ready"]').waitFor();
    // A fixed gesture timeline distinguishes moving release from a real pause;
    // runner scheduling must not turn these 20ms samples into stale movement.
    // The suite timeout is shorter than this window; command transport cannot
    // turn the requested pause into a timestamp already in the past.
    await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
    const rect = await rail.boundingBox();
    const y = rect.y + 60, x = rect.x + rect.width * .7;
    await page.mouse.move(x, y); await page.mouse.down();
    await page.clock.runFor(20); await page.mouse.move(x - 30, y);
    await page.clock.runFor(20); await page.mouse.move(x - 60, y);
    await page.clock.runFor(20); await page.mouse.move(x - 90, y);
    await page.mouse.up();
    const release = await rail.evaluate(node => node.scrollLeft);
    await page.clock.runFor(150);
    const coast = await rail.evaluate(node => ({ left: node.scrollLeft, maximum: node.scrollWidth - node.clientWidth }));
    assert.ok(coast.left > release + 10, `release retains momentum: ${release} -> ${coast.left} (max ${coast.maximum})`);
    assert.equal(await page.getByRole('dialog', { name: 'Expanded work' }).count(), 0, 'drag never opens a card');
    await page.clock.resume();
    await page.getByRole('button', { name: 'Expand INSCAPE details', exact: true }).click();
    await page.waitForTimeout(500);
    assert.equal(await rail.getAttribute('data-dragging'), null);
    await page.getByRole('button', { name: 'Collapse INSCAPE details', exact: true }).click();
    await page.waitForTimeout(500);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await rail.evaluate(node => node.scrollLeft = 0);
    await rail.focus(); await page.keyboard.press('ArrowRight');
    assert.ok(await rail.evaluate(node => node.scrollLeft) > 0);
  } finally { await browser.close(); }
});

