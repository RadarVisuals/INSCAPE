import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
import { setWorkbenchZoom } from './fixtures/workbench-zoom.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5194';
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const boardSelector = '.system-workflow__presentation-board';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">
  <rect width="640" height="480" fill="#593887"/><circle cx="320" cy="240" r="110" fill="#f54789"/>
  <script><![CDATA[window.liftIdentity = Math.random(); window.ticks = 0;
  function tick() { window.ticks++; requestAnimationFrame(tick); } tick();]]></script>
</svg>`;
const ready = page => page.locator(`${boardSelector}[data-display-lift]:not([data-lift-moving])`).waitFor();
const state = page => page.evaluate(selector => {
  const node = document.querySelector(selector), host = node.closest('.system-workflow');
  return { frame: node.getBoundingClientRect().toJSON(), width: node.clientWidth, height: node.clientHeight,
    scale: node.dataset.workbenchScale, pan: [host.style.getPropertyValue('--workbench-pan-x'), host.style.getPropertyValue('--workbench-pan-y')],
    saved: localStorage.getItem(window.__motionKey) };
}, boardSelector);
const open = async page => {
  const button = page.getByRole('button', { name: 'Enlarge Display', exact: true });
  await button.focus(); await page.keyboard.press('Enter');
  await page.locator(`${boardSelector}[data-display-lift]`).waitFor();
};
const close = async page => {
  await page.keyboard.press('Escape');
  await page.locator(`${boardSelector}[data-display-lift]`).waitFor({ state: 'detached' });
};

test('whole Display inspection retains live content and authored layout in owner and Visitor', { timeout: 180000 }, async () => {
  const browser = await chromium.launch({ executablePath: edge, headless: true });
  await mkdir('.browser-test-runtime/display-module-lift', { recursive: true });
  try {
    for (const visitor of [false, true]) for (const width of [1600, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, deviceScaleFactor: 1.25 });
      page.setDefaultTimeout(15000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mountGridMotionFixture(page, { origin, visitor, heavy: true, count: 2, displayWidth: 600, seamReview: 'single',
        artwork: { url: 'https://motion.invalid/live.svg', width: 640, height: 480, body: svg } });
      const board = page.locator(boardSelector);
      await board.waitFor(); await setWorkbenchZoom(page, .56);
      const placement = board.locator('.system-workflow__placement[tabindex="0"], .lattice-production-placement[tabindex="0"]').first();
      const frame = placement.locator('iframe');
      await frame.waitFor({ state: 'attached' });
      await placement.locator('.artwork-svg-status').waitFor({ state: 'detached' });
      const iframe = await frame.elementHandle();
      const host = await iframe.contentFrame();
      const runtime = host.childFrames()[0];
      await runtime.evaluate(() => {
        window.liftIdentity = Math.random(); window.ticks = 0;
        function tick() { window.ticks++; requestAnimationFrame(tick); } tick();
      });
      const identity = await runtime.evaluate(() => ({ id: window.liftIdentity, ticks: window.ticks, width: innerWidth, height: innerHeight }));
      if (!visitor) {
        // Establish a real undoable edit. Inspection must not allow Ctrl+Z to
        // alter authored content while keyboard focus is inside its live Stage.
        await placement.focus(); await page.keyboard.press('Space'); await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(100);
      }
      const before = await state(page);
      await open(page); await ready(page);
      const during = await state(page);
      assert.ok(during.frame.width > before.frame.width, 'Display enlarges');
      assert.ok(during.frame.left >= 0 && during.frame.right <= width && during.frame.top >= 0 && during.frame.bottom <= 1000, 'Display fits viewport');
      assert.ok(during.width > before.width && during.height > before.height, 'Stage paints at inspection resolution');
      assert.ok(Math.abs(during.width - during.frame.width * 1.25) < 1, 'Stage has one rendered pixel per device pixel');
      assert.equal(during.saved, before.saved, 'lift is not persisted');
      assert.equal(await board.evaluate(node => node.inert), false, 'enlarged Display stays interactive');
      assert.equal(await board.locator('.system-workflow__resize-handle').count(), 0, 'editing handles are unavailable');
      const continuity = await runtime.evaluate(() => ({ id: window.liftIdentity, ticks: window.ticks, width: innerWidth, height: innerHeight }));
      assert.equal(continuity.id, identity.id); assert.ok(continuity.ticks > identity.ticks, 'SVG keeps animating');
      assert.equal(continuity.width, identity.width); assert.equal(continuity.height, identity.height);
      assert.equal(await frame.evaluate((node, original) => node === original, iframe), true);
      assert.equal(await page.locator('.display-module-lift-backdrop, .display-module-lift, .display-module-lift-controls').count(), 0, 'enlargement adds no modal, dimmer or extra controls');
      await page.keyboard.press('Delete');
      await placement.focus(); await page.keyboard.press('Control+z');
      assert.equal((await state(page)).saved, before.saved, 'inspection cannot undo authored edits');
      await page.mouse.move(width / 2, 500); await page.keyboard.down('Control'); await page.mouse.wheel(0, -150); await page.keyboard.up('Control');
      assert.equal((await state(page)).scale, before.scale);
      assert.equal((await state(page)).saved, before.saved);
      await page.screenshot({ path: `.browser-test-runtime/display-module-lift/${visitor ? 'visitor' : 'owner'}-${width}.png` });
      // Artwork inspection is nested inside the enlarged Display; Escape closes
      // that artwork first and keeps the whole Display enlarged.
      if (visitor) await placement.click(); else await placement.dblclick();
      await page.getByRole('button', { name: 'Close artwork viewer' }).waitFor();
      await page.waitForTimeout(550);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Close artwork viewer' }).waitFor({ state: 'detached' });
      assert.equal(await board.getAttribute('data-display-lift'), 'true');
      // Navigation remains available without enabling composition editing.
      const activeGrid = () => board.locator('[data-rendered-grid-id]:not([aria-hidden="true"])').getAttribute('data-rendered-grid-id');
      const initialGrid = await activeGrid();
      const stage = await board.boundingBox();
      await page.mouse.move(stage.x + stage.width * .8, stage.y + stage.height * .65);
      await page.mouse.down();
      assert.equal(await board.getAttribute('data-display-lift'), 'true', 'first pointer-down does not close the Display');
      await page.mouse.move(stage.x - 8, stage.y + stage.height * .65, { steps: 12 });
      await page.waitForTimeout(170); await page.mouse.up(); await page.waitForTimeout(700);
      assert.notEqual(await activeGrid(), initialGrid, 'dragging the enlarged Stage navigates Grids');
      assert.equal(await board.getAttribute('data-display-lift'), 'true', 'a swipe released outside is not an outside click');
      await page.mouse.move(stage.x + stage.width * .2, stage.y + stage.height * .65);
      await page.mouse.down();
      await page.mouse.move(stage.x + stage.width * .8, stage.y + stage.height * .65, { steps: 12 });
      await page.waitForTimeout(170); await page.mouse.up(); await page.waitForTimeout(700);
      assert.equal(await activeGrid(), initialGrid);
      await page.getByRole('button', { name: 'Restore Display', exact: true }).click();
      await page.locator(`${boardSelector}[data-display-lift]`).waitFor({ state: 'detached' });
      const after = await state(page);
      assert.deepEqual(after, before, 'return restores exact frame, camera and saved state');
      assert.equal(await page.getByRole('button', { name: 'Enlarge Display', exact: true }).evaluate(node => document.activeElement === node), true, 'focus returns to trigger');
      assert.equal(await page.getByRole('button', { name: 'Reset Workbench zoom to 100%' }).isEnabled(), true);
      // Interrupted opening, outside click, live viewport resize and reduced motion.
      await open(page); await close(page);
      assert.deepEqual(await state(page), before);
      await open(page); await ready(page);
      await page.setViewportSize({ width: width - 30, height: 800 });
      await page.waitForTimeout(100);
      const resized = (await state(page)).frame;
      assert.ok(resized.right <= width - 30 && resized.bottom <= 800, 'open lift refits on viewport resize');
      await page.mouse.click(5, 400);
      await page.locator(`${boardSelector}[data-display-lift]`).waitFor({ state: 'detached' });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await open(page); await ready(page); await close(page);
      await open(page);
      await page.evaluate(() => window.__motionRoot.unmount());
      await page.locator(`${boardSelector}[data-display-lift]`).waitFor({ state: 'detached' });
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});

test('a secondary Display lifts above its siblings and releases its isolated host on return', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: edge, headless: true });
  try {
    for (const visitor of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
      await mountGridMotionFixture(page, { origin, visitor, count: 2, seamReview: 'single', textModes: true,
        adjoiningModules: { secondaryDisplay: true } });
      // Normal window styles can arrive after the enlargement styles in the
      // real app. That must not lower the enlarged Display beneath siblings.
      await page.addStyleTag({ path: visitor ? 'src/profileDocument/components/visitorGridWorld.css'
        : 'src/public/ownerSystemWorkflow/ownerSystemWorkflow.css' });
      const board = page.locator(boardSelector);
      await board.waitFor();
      await page.locator('.image-module__window').nth(1).waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('.system-workflow__presentation-board img')].every(node => node.complete && node.naturalWidth));
      const before = await state(page);
      const siblingFrames = () => page.locator('.image-module__window').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
      const siblings = await siblingFrames();
      await open(page); await ready(page);
      assert.equal(await board.evaluate(node => getComputedStyle(node).zIndex), '201', 'late window styles cannot lower the enlarged Display');
      const box = await board.boundingBox();
      for (const sibling of siblings) {
        const left = Math.max(box.x, sibling.left), right = Math.min(box.x + box.width, sibling.right);
        const top = Math.max(box.y, sibling.top), bottom = Math.min(box.y + box.height, sibling.bottom);
        if (left >= right || top >= bottom) continue;
        assert.equal(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('.system-workflow__presentation-board')),
          { x: (left + right) / 2, y: (top + bottom) / 2 }), true, 'enlarged Display receives input above overlapping sibling modules');
      }
      assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-display-instance]')?.dataset.displayInstance,
        { x: box.x + box.width / 2, y: box.y + box.height / 2 }), 'display:motion-secondary');
      assert.deepEqual(await siblingFrames(), siblings, 'sibling module frames stay unchanged');
      await page.screenshot({ path: `.browser-test-runtime/display-module-lift/secondary-${visitor ? 'visitor' : 'owner'}.png` });
      await close(page);
      assert.deepEqual(await state(page), before);
      assert.equal(await page.locator('[data-display-lift-host]').count(), 0);
      await page.close();
    }
  } finally { await browser.close(); }
});
