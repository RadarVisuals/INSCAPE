import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5194';

test('landing never exposes the previous Grid again during animation handoff', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ executablePath: process.env.INSCAPE_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const visitor of [false, true]) for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      await mountGridMotionFixture(page, { origin, visitor, heavy: true, displayWidth: 1001.3 });
      const stage = page.locator(visitor ? '.visitor-grid-world__viewport' : '[data-system-workflow-artboard]');
      await stage.waitFor(); await page.waitForTimeout(700);
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      for (const direction of [-1, 1, -1]) {
        const box = await stage.boundingBox(), x = box.x + box.width * .5, y = box.y + box.height * .6;
        if (!visitor) await page.keyboard.down('Space');
        await page.mouse.move(x, y); await page.mouse.down();
        const samples = await page.evaluate(async ({ x, y, direction, visitor }) => {
          const viewport = document.querySelector(visitor ? '.visitor-grid-world__viewport' : '[data-system-workflow-artboard]');
          const track = viewport.querySelector('.system-workflow__grid-track,.visitor-grid-world__grid-track');
          const distance = viewport.getBoundingClientRect().width;
          window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, bubbles: true, clientX: x + direction * distance * .7, clientY: y }));
          await new Promise(resolve => setTimeout(resolve, 160));
          const samples = [], start = performance.now();
          const observe = () => {
            const bounds = viewport.getBoundingClientRect(), center = bounds.x + bounds.width / 2;
            const visible = [...track.children].filter(node => {
              const rect = node.getBoundingClientRect();
              return rect.left < center && rect.right > center;
            }).map(node => node.dataset.renderedGridId);
            samples.push({ time: performance.now() - start, position: new DOMMatrix(getComputedStyle(track).transform).m41, visible });
            if (performance.now() - start < 1000) requestAnimationFrame(observe);
          };
          observe();
          window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
          await new Promise(resolve => setTimeout(resolve, 1100));
          return samples;
        }, { x, y, direction, visitor });
        await page.mouse.up(); if (!visitor) await page.keyboard.up('Space');
        assert.ok(samples.length > 10);
        for (const sample of samples) assert.deepEqual(sample.visible, samples[0].visible,
          `${visitor ? 'Visitor' : 'owner'} ${width}: the incoming Grid must stay visible throughout landing at ${sample.time}ms`);
        for (let i = 1; i < samples.length; i++) assert.ok(direction * (samples[i].position - samples[i - 1].position) >= -.05,
          `${visitor ? 'Visitor' : 'owner'} ${width}: camera must not jump backward on landing at ${samples[i].time}ms`);
        const intrusions = await stage.evaluate(viewport => {
          const bounds = viewport.getBoundingClientRect();
          return [...viewport.querySelectorAll('.system-workflow__grid-plane--adjacent,.visitor-grid-world__grid-plane--adjacent')].map(node => {
            const rect = node.getBoundingClientRect();
            return Math.max(0, Math.min(bounds.right, rect.right) - Math.max(bounds.left, rect.left));
          });
        });
        assert.ok(intrusions.every(width => width < .02), `neighbouring Grids must remain outside the landed viewport: ${intrusions}`);
      }
      // Inspecting a landed Grid must freeze its camera, not reset the retained rail.
      const cameraBefore = await stage.locator('.system-workflow__grid-track,.visitor-grid-world__grid-track').evaluate(el => getComputedStyle(el).transform);
      await page.evaluate(() => {
        window.__inspectionCamera = [];
        window.__recordInspectionCamera = true;
        const sample = () => {
          const track = document.querySelector('.system-workflow__grid-track,.visitor-grid-world__grid-track');
          window.__inspectionCamera.push(getComputedStyle(track).transform);
          if (window.__recordInspectionCamera) requestAnimationFrame(sample);
        }; sample();
      });
      const source = page.locator(visitor ? '[data-placement-id][tabindex="0"]' : '.system-workflow__placement[tabindex="0"]').first();
      await source.focus(); await page.keyboard.press('Enter');
      await page.locator('.system-workflow__lift-artwork').waitFor();
      await page.waitForTimeout(600);
      await page.keyboard.press('Escape');
      await page.locator('.system-workflow__lift-artwork').waitFor({ state: 'detached' });
      const inspectionCamera = await page.evaluate(() => { window.__recordInspectionCamera = false; return window.__inspectionCamera; });
      assert.ok(inspectionCamera.every(transform => transform === cameraBefore), `${visitor ? 'Visitor' : 'owner'} ${width}: inspection must retain the landed camera on every frame`);
      await page.screenshot({ path: `.browser-test-runtime/grid-landing-${visitor ? 'visitor' : 'owner'}-${width}.png` });
      // Contrasting neighbours also reveal texture filtering across the fixed
      // outer clip, even when their DOM rectangles are geometrically outside.
      await page.addStyleTag({ content: `
        .system-workflow__grid-plane,.visitor-grid-world__grid-plane { background: rgb(0,0,255) !important; }
        .system-workflow__grid-plane--current,.visitor-grid-world__grid-plane--current { background: rgb(128,128,128) !important; }
        .system-workflow__grid-plane > *,.visitor-grid-world__grid-plane > * { visibility: hidden !important; }
      ` });
      const bounds = await stage.boundingBox();
      const data = (await page.screenshot()).toString('base64');
      const blueEdge = await page.evaluate(async ({ data, bounds }) => {
        const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
        const y = Math.floor(bounds.y + bounds.height / 2);
        return [Math.floor(bounds.x), Math.ceil(bounds.x), Math.floor(bounds.x + bounds.width) - 1].some(x => {
          const [red, , blue] = context.getImageData(x, y, 1, 1).data;
          return blue > red + 8;
        });
      }, { data, bounds });
      assert.equal(blueEdge, false, 'a landed Grid must not sample the contrasting neighbour through its outer edge');
      await page.close();
    }
  } finally { await browser.close(); }
});
