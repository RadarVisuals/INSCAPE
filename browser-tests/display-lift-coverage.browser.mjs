import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';

test('Lift covers the adjoining artwork edge through its final frames and leaves no second fade', { timeout: 180000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    await mkdir('.browser-test-runtime', { recursive: true });
    const generator = await browser.newPage();
    const red = await generator.evaluate(() => {
      const c = document.createElement('canvas'); c.width = c.height = 400;
      const x = c.getContext('2d'); x.fillStyle = 'red'; x.fillRect(0, 0, 400, 400);
      return c.toDataURL().split(',')[1];
    });
    await generator.close();
    for (const visitor of [false, true]) for (const density of [1, 1.25, 1.5, 2]) {
      const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: density });
      const label = `${visitor ? 'Visitor' : 'Owner'}-${density}`;
      await mountGridMotionFixture(page, { origin: process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5207', visitor,
        count: 3, displayWidth: 1190.3, seamReview: true, grain: 0,
        artwork: { url: 'https://motion.invalid/lift-red.png', body: Buffer.from(red, 'base64'), contentType: 'image/png', width: 400, height: 400 } });
      await page.locator('.system-workflow__presentation-board').waitFor(); await setWorkbenchZoom(page, .56);
      const source = page.locator('.system-workflow__grid-plane--current .system-workflow__placement, .visitor-grid-world__grid-plane--current .lattice-production-placement').first();
      await page.waitForFunction(() => [...document.querySelectorAll('.system-workflow__presentation-board img')].every(i => i.complete && i.naturalWidth));
      const saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
      await source.dispatchEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      await page.waitForFunction(() => Number(document.querySelector('.system-workflow__lift-artwork')?.parentElement.style.getPropertyValue('--inspection-lift-progress')) === 1);
      await page.clock.install(); await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
      await page.keyboard.press('Escape'); await page.clock.runFor(400);
      const frames = [];
      for (let frame = 0; frame < 8; frame++) {
        await page.clock.runFor(16);
        const rect = await source.boundingBox(); const png = await page.screenshot();
        const data = await page.evaluate(async ({ b64, rect }) => {
          const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode();
          const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
          const x = c.getContext('2d'); x.drawImage(i, 0, 0);
          const edge = Math.round((rect.x + rect.width) * devicePixelRatio);
          const y = Math.round((rect.y + rect.height * .55) * devicePixelRatio);
          const pixels = [-1, 0, 1].map(offset => [...x.getImageData(edge + offset, y, 1, 1).data]);
          const lift = document.querySelector('.system-workflow__lift-artwork');
          return { progress: lift ? Number(lift.parentElement.style.getPropertyValue('--inspection-lift-progress')) : null, pixels,
            transitions: [...document.querySelectorAll('.system-workflow__placement, .lattice-production-placement')].flatMap(n => n.getAnimations()).map(a => a.transitionProperty) };
        }, { b64: png.toString('base64'), rect });
        frames.push(data);
        if (data.pixels.some(p => p[0] < 250 || p[1] > 5 || p[2] > 5))
          await writeFile(`.browser-test-runtime/lift-edge-${label}-${frame}.png`, png);
        for (const pixel of data.pixels) assert.ok(pixel[0] >= 250 && pixel[1] <= 5 && pixel[2] <= 5, `${label} return frame ${frame}: ${pixel}`);
        if (data.progress === null) assert.deepEqual(data.transitions, [], `${label} return finishes all fading`);
      }
      assert.ok(frames.some(f => f.progress !== null && f.progress < .001), 'sampled the returning copy at its source edge');
      assert.equal(frames.at(-1).progress, null, 'sampled the restored source');
      assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)), saved);
      console.log(`${label}: 8 return frames passed`); await page.close();
    }
  } finally { await browser.close(); }
});

test('native-fit artwork outside the Stage returns without a lingering filter transition', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const visitor of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 2560, height: 1305 }, deviceScaleFactor: 1 });
      await mountGridMotionFixture(page, { origin: process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5207', visitor,
        count: 3, displayWidth: 888, seamReview: 'native-outside', grain: 0,
        artwork: { url: 'https://motion.invalid/motion-artwork.png', width: 2560, height: 1440 } });
      const source = page.locator('.system-workflow__grid-plane--current .system-workflow__placement, .visitor-grid-world__grid-plane--current .lattice-production-placement').nth(1);
      await source.waitFor();
      await source.dispatchEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      await page.waitForFunction(() => Number(document.querySelector('.system-workflow__lift-artwork')?.parentElement.style.getPropertyValue('--inspection-lift-progress')) === 1);
      await page.clock.install(); await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
      await page.keyboard.press('Escape'); await page.clock.runFor(496);
      assert.equal(await page.locator('.system-workflow__lift-artwork').count(), 0);
      const state = await page.locator('.system-workflow__inspection-scene').evaluate(n => ({
        filters: [...n.querySelectorAll('.system-workflow__placement, .lattice-production-placement')].map(p => getComputedStyle(p).filter),
        animations: n.getAnimations({ subtree: true }).map(a => a.transitionProperty),
      }));
      assert.ok(state.filters.every(f => f === 'none'), JSON.stringify(state));
      assert.deepEqual(state.animations, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test('In place retains its own CSS opening and closing fade', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    for (const visitor of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await mountGridMotionFixture(page, { origin: process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5207', visitor,
        displayWidth: 600, seamReview: true, inspectionMode: 'IN_PLACE' });
      const source = page.locator('.system-workflow__grid-plane--current .system-workflow__placement, .visitor-grid-world__grid-plane--current .lattice-production-placement').nth(1);
      await source.waitFor();
      await page.clock.install(); await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
      await source.dispatchEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      const background = page.locator('[data-inspection-context="background"]').first();
      const middle = async () => background.evaluate(n => {
        const a = n.getAnimations().find(a => a.transitionProperty === 'filter');
        if (!a) return null;
        a.pause(); a.currentTime = 180;
        const brightness = Number(getComputedStyle(n).filter.match(/brightness\(([\d.]+)\)/)?.[1]);
        a.finish(); return brightness;
      });
      await background.waitFor();
      assert.equal(await page.locator('.system-workflow__lift-artwork').count(), 0);
      const opening = await middle();
      assert.ok(opening > .18 && opening < 1, `In place opening: ${opening}`);
      await page.keyboard.press('Escape');
      const closing = await middle();
      assert.ok(closing > .18 && closing < 1, `In place closing: ${closing}`);
      await page.clock.runFor(400);
      assert.equal(await page.locator('[data-inspection-context]').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Reset Workbench position', exact: true }).isDisabled(), false);
      await page.close();
    }
  } finally { await browser.close(); }
});
