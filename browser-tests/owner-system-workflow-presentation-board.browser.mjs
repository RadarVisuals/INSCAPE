import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = process.env.INSCAPE_SYSTEM_WORKFLOW_URL || 'http://127.0.0.1:5173/development/owner/system-workflow';
const SCREENSHOT_DIR = process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR
  ? resolve(process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR) : null;

const closeEnough = (left, right, tolerance = 0.2) => Math.abs(left - right) <= tolerance;

async function boardMetrics(page) {
  return page.evaluate(() => {
    const rectangle = (selector) => {
      const value = document.querySelector(selector).getBoundingClientRect();
      return { height: value.height, left: value.left, top: value.top, width: value.width };
    };
    const strip = document.querySelector('.system-workflow__identity-strip');
    const mark = document.querySelector('.system-workflow__identity-mark');
    return {
      board: rectangle('.system-workflow__presentation-board'),
      dock: rectangle('.system-workflow__global-bar'),
      fontSize: getComputedStyle(strip.querySelector('strong')).fontSize,
      mark: rectangle('.system-workflow__identity-mark'),
      markBorder: getComputedStyle(mark).borderTopWidth,
      stage: rectangle('[data-presentation-stage]'),
      strip: rectangle('.system-workflow__identity-strip'),
    };
  });
}

async function setSlider(page, percentage) {
  await page.getByRole('slider', { name: 'Board zoom' }).fill(String(percentage));
  await page.waitForFunction((value) => document.querySelector('[data-board-scale]')?.dataset.boardScale === String(value / 100), percentage);
}

async function capture(page, viewportName, percentage) {
  if (!SCREENSHOT_DIR) return;
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, `presentation-board-zoom-${viewportName}-${percentage}.png`) });
}

test.skip('legacy slider contract replaced by direct corner resizing', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));
    await page.goto(URL, { waitUntil: 'networkidle' });
    assert.deepEqual(pageErrors, []);
    await page.evaluate(() => {
      window.__workflowWrites = 0;
      addEventListener('inscape:review-storage-write', () => { window.__workflowWrites += 1; });
    });

    const slider = page.getByRole('slider', { name: 'Board zoom' });
    const number = page.getByRole('spinbutton', { name: 'Board zoom percentage' });
    assert.equal(await slider.getAttribute('min'), '25');
    assert.equal(await slider.getAttribute('step'), '1');
    assert.equal(await slider.inputValue(), '100');
    assert.equal(await number.inputValue(), '100');
    assert.equal(await slider.getAttribute('max'), '100');

    const wideDefault = await boardMetrics(page);
    for (const percentage of [25, 50, 75, 100]) {
      await setSlider(page, percentage);
      assert.equal(await number.inputValue(), String(percentage));
      const metrics = await boardMetrics(page);
      assert.ok(closeEnough(metrics.board.width, metrics.strip.width), JSON.stringify({ percentage, metrics }));
      assert.ok(closeEnough(metrics.board.width, metrics.stage.width), JSON.stringify({ percentage, metrics }));
      assert.ok(closeEnough(metrics.board.height, metrics.stage.height + metrics.strip.height), JSON.stringify({ percentage, metrics }));
      assert.ok(closeEnough(metrics.stage.width / metrics.stage.height, 16 / 9, 0.002));
      assert.ok(closeEnough(metrics.strip.height, wideDefault.strip.height));
      assert.equal(metrics.fontSize, wideDefault.fontSize);
      assert.ok(closeEnough(metrics.mark.width, wideDefault.mark.width));
      assert.equal(metrics.markBorder, wideDefault.markBorder);
      assert.deepEqual(metrics.dock, wideDefault.dock);
      await capture(page, 'wide', percentage);
    }
    await capture(page, 'wide', `max-${await slider.getAttribute('max')}`);

    await number.fill('');
    await number.press('Enter');
    assert.equal(await number.inputValue(), '100');
    await number.fill('-999');
    await number.press('Enter');
    assert.equal(await slider.inputValue(), '25');
    await number.fill('9999');
    await number.press('Enter');
    assert.equal(await slider.inputValue(), '100');
    await number.fill('50');
    await number.press('Escape');
    assert.equal(await number.inputValue(), '100');
    await number.press('ArrowDown');
    assert.equal(await slider.inputValue(), '99');
    await number.press('ArrowUp');
    assert.equal(await slider.inputValue(), '100');
    assert.equal(await page.evaluate(() => window.__workflowWrites), 0);

    await setSlider(page, 75);
    await page.setViewportSize({ width: 390, height: 720 });
    await page.waitForFunction(() => document.querySelector('.system-workflow')?.dataset.layout === 'narrow'
      && document.querySelector('[data-presentation-workbench]')?.clientWidth === 390);
    assert.equal(await slider.inputValue(), '75');
    assert.equal(await number.inputValue(), '75');
    assert.equal(await slider.getAttribute('max'), '100');
    const narrowReference = await boardMetrics(page);
    for (const percentage of [25, 50, 75, 100]) {
      await setSlider(page, percentage);
      const metrics = await boardMetrics(page);
      assert.ok(closeEnough(metrics.board.width, metrics.strip.width));
      assert.ok(closeEnough(metrics.board.width, metrics.stage.width));
      assert.ok(closeEnough(metrics.strip.height, narrowReference.strip.height), JSON.stringify({ percentage, metrics, narrowReference }));
      assert.equal(metrics.fontSize, narrowReference.fontSize);
      assert.ok(closeEnough(metrics.mark.width, narrowReference.mark.width));
      assert.deepEqual(metrics.dock, narrowReference.dock);
      assert.equal(await number.inputValue(), String(percentage));
      await capture(page, 'narrow', percentage);
    }
    await capture(page, 'narrow', `max-${await slider.getAttribute('max')}`);
    assert.equal(await page.evaluate(() => window.__workflowWrites), 0);
  } finally {
    await browser.close();
  }
});

test.skip('legacy percentage projection contract replaced by direct Board geometry', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    for (const percentage of [25, 100]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(URL, { waitUntil: 'networkidle' });
      await page.evaluate(() => {
        window.__workflowWrites = 0;
        addEventListener('inscape:review-storage-write', () => { window.__workflowWrites += 1; });
      });
      await setSlider(page, percentage);
      assert.equal(await page.evaluate(() => window.__workflowWrites), 0);

      const placement = page.getByRole('button', { name: /Select ABYSSAL STUDY/ });
      await placement.click();
      await page.waitForFunction(() => document.querySelector('[aria-label^="Select ABYSSAL STUDY"]')?.getAttribute('aria-pressed') === 'true');
      const before = await placement.boundingBox();
      const cellSize = await page.locator('.system-workflow__canvas').evaluate((node) => (
        Number.parseFloat(getComputedStyle(node).getPropertyValue('--world-cell-size'))
        * Number(node.closest('[data-board-scale]').dataset.boardScale)
      ));
      await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
      await page.mouse.down();
      await page.mouse.move(before.x + before.width / 2 + cellSize * 1.1, before.y + before.height / 2, { steps: 4 });
      await page.mouse.up();
      const after = await placement.boundingBox();
      const board = await page.locator('.system-workflow__presentation-board').boundingBox();
      const stage = await page.locator('[data-presentation-stage]').boundingBox();
      assert.equal(await page.evaluate(() => window.__workflowWrites), 1,
        JSON.stringify({ after, before, board, cellSize, percentage, stage }));
      assert.ok(closeEnough(after.x - before.x, cellSize, 0.75), JSON.stringify({ after, before, cellSize, percentage }));

      const handle = page.getByRole('button', { name: 'Resize selection from se' });
      const handleBox = await handle.boundingBox();
      assert.ok(closeEnough(handleBox.width, 8, 0.2), JSON.stringify({ handleBox, percentage }));
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

test('Metadata docks, projects down and beside the Board, undocks, closes, and can be re-added', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(URL, { waitUntil: 'networkidle' });
    const metadataMotionSupported = await page.evaluate(() => {
      if (typeof Element.prototype.animate !== 'function') return false;
      const animate = Element.prototype.animate;
      globalThis.__inscapeMetadataAnimationFrames = [];
      globalThis.__inscapeMetadataViewTransitionCount = 0;
      if (typeof document.startViewTransition === 'function') {
        const start = document.startViewTransition.bind(document);
        document.startViewTransition = (callback) => {
          globalThis.__inscapeMetadataViewTransitionCount += 1;
          return start(callback);
        };
      }
      Element.prototype.animate = function instrumentMetadataAnimation(keyframes, options) {
        if (this.matches?.('.system-workflow__metadata-down-host, .system-workflow__metadata-projection.is-side, .system-workflow__metadata-module')) {
          globalThis.__inscapeMetadataAnimationFrames.push({
            className: this.className,
            duration: options?.duration,
            keyframes,
          });
        }
        return animate.call(this, keyframes, options);
      };
      return true;
    });
    const board = page.locator('.system-workflow__presentation-board');
    const waitForMetadataMotion = () => page.waitForFunction(() => {
      const node = document.querySelector(
        '.system-workflow__metadata-down-host, .system-workflow__metadata-projection.is-side, .system-workflow__metadata-module',
      );
      return !node || node.getAnimations({ subtree: true }).every((animation) => animation.playState === 'finished');
    });
    const before = await board.boundingBox();
    const header = board.locator('.system-workflow__identity-strip');
    const handle = await header.boundingBox();
    await page.mouse.move(handle.x + 80, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + 150, handle.y + 55, { steps: 4 });
    await page.mouse.up();
    const after = await board.boundingBox();
    assert.ok(after.x > before.x + 50 && after.y > before.y + 35, JSON.stringify({ before, after }));

    assert.equal(await page.getByRole('complementary', { name: 'Metadata module' }).count(), 0);
    await page.getByRole('button', { name: 'Open Metadata below Board bar' }).click();
    const dropdown = page.getByRole('complementary', { name: 'Metadata below Presentation Board bar' });
    await dropdown.waitFor();
    await waitForMetadataMotion();
    const dropdownAlignment = await page.evaluate(() => {
      const boardRect = document.querySelector('.system-workflow__presentation-board').getBoundingClientRect();
      const panelRect = document.querySelector('.system-workflow__metadata-projection.is-down').getBoundingClientRect();
      return { boardRight: boardRect.right, panelRight: panelRect.right };
    });
    assert.ok(closeEnough(dropdownAlignment.boardRight, dropdownAlignment.panelRight));
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'presentation-board-metadata-down-wide.png') });
    await page.getByRole('button', { name: 'Open Metadata beside Presentation Board' }).click();
    await dropdown.waitFor({ state: 'detached' });
    const side = page.getByRole('complementary', { name: 'Metadata beside Presentation Board' });
    await side.waitFor();
    await waitForMetadataMotion();
    const sideAlignment = await page.evaluate(() => {
      const boardRect = document.querySelector('.system-workflow__presentation-board').getBoundingClientRect();
      const panelRect = document.querySelector('.system-workflow__metadata-projection.is-side').getBoundingClientRect();
      const content = document.querySelector('.system-workflow__metadata-projection.is-side .system-workflow__metadata-module-content');
      const first = content.querySelector(':scope > section');
      const second = first.nextElementSibling;
      const last = content.lastElementChild;
      const contentRect = content.getBoundingClientRect();
      const firstRect = first.getBoundingClientRect();
      const secondRect = second.getBoundingClientRect();
      const lastRect = last.getBoundingClientRect();
      const headerRect = document.querySelector('.system-workflow__identity-strip').getBoundingClientRect();
      const metadataControls = document.querySelector('.system-workflow__metadata-dock-controls');
      const windowControls = document.querySelector('.system-workflow__board-window-controls');
      const metadataControlsRect = metadataControls.getBoundingClientRect();
      const windowControlsRect = windowControls.getBoundingClientRect();
      const controlCenters = [...document.querySelectorAll('.system-workflow__board-title button')]
        .map((button) => {
          const rect = button.getBoundingClientRect();
          return rect.top + rect.height / 2;
        });
      const boardNode = document.querySelector('.system-workflow__presentation-board');
      const boardStyle = getComputedStyle(boardNode);
      const frameStyle = getComputedStyle(boardNode, '::before');
      return {
        boardRight: boardRect.right,
        frameGap: Number.parseFloat(boardStyle.getPropertyValue('--workflow-board-frame-gap')),
        buttonCenterOffsets: controlCenters.map((center) => center - (headerRect.top + headerRect.height / 2)),
        contentBottomGap: contentRect.bottom - lastRect.bottom,
        contentLeftGap: firstRect.left - panelRect.left,
        contentRightGap: panelRect.right - firstRect.right,
        contentTopGap: firstRect.top - panelRect.top,
        firstCellGap: secondRect.top - firstRect.bottom,
        frameBottom: frameStyle.bottom,
        frameLeft: frameStyle.left,
        frameRight: frameStyle.right,
        frameRadius: frameStyle.borderRadius,
        header: headerRect.toJSON(),
        metadataControls: metadataControlsRect.toJSON(),
        metadataSeparator: getComputedStyle(metadataControls).borderLeftWidth,
        panelLeft: panelRect.left,
        ratio: boardRect.width / (boardRect.height - 38),
        windowControls: windowControlsRect.toJSON(),
        windowSeparator: getComputedStyle(windowControls).borderLeftWidth,
      };
    });
    assert.equal(sideAlignment.frameGap, 8);
    assert.ok(closeEnough(sideAlignment.panelLeft - sideAlignment.boardRight, sideAlignment.frameGap));
    assert.ok(closeEnough(sideAlignment.ratio, 16 / 9, 0.003));
    for (const gap of [sideAlignment.contentTopGap, sideAlignment.firstCellGap]) {
      assert.ok(closeEnough(gap, 8, 0.75), JSON.stringify(sideAlignment));
    }
    for (const gap of [sideAlignment.contentLeftGap, sideAlignment.contentRightGap, sideAlignment.contentBottomGap]) {
      assert.ok(closeEnough(gap, 0, 0.75), JSON.stringify(sideAlignment));
    }
    assert.equal(sideAlignment.frameLeft, '-9px');
    assert.equal(sideAlignment.frameBottom, '-9px');
    assert.equal(sideAlignment.frameRight, '-295px');
    assert.equal(sideAlignment.frameRadius, '12px');
    assert.equal(sideAlignment.metadataSeparator, '1px');
    assert.equal(sideAlignment.windowSeparator, '1px');
    assert.ok(closeEnough(sideAlignment.metadataControls.top, sideAlignment.header.top, 0.25), JSON.stringify(sideAlignment));
    assert.ok(closeEnough(sideAlignment.metadataControls.bottom, sideAlignment.header.bottom, 0.25), JSON.stringify(sideAlignment));
    assert.ok(closeEnough(sideAlignment.windowControls.top, sideAlignment.header.top, 0.25), JSON.stringify(sideAlignment));
    assert.ok(closeEnough(sideAlignment.windowControls.bottom, sideAlignment.header.bottom, 0.25), JSON.stringify(sideAlignment));
    assert.ok(sideAlignment.buttonCenterOffsets.every((offset) => Math.abs(offset) <= 0.5), JSON.stringify(sideAlignment));
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'presentation-board-metadata-side-wide.png') });

    const sidecarResizeHandle = await page.getByRole('button', { name: 'Resize Presentation Board from se' }).boundingBox();
    await page.mouse.move(sidecarResizeHandle.x + sidecarResizeHandle.width / 2,
      sidecarResizeHandle.y + sidecarResizeHandle.height / 2);
    await page.mouse.down();
    await page.mouse.move(sidecarResizeHandle.x + 1_000, sidecarResizeHandle.y + 600, { steps: 10 });
    await page.mouse.up();
    const resizedSidecarGroup = await page.evaluate(() => {
      const boardRect = document.querySelector('.system-workflow__presentation-board').getBoundingClientRect();
      const panelRect = document.querySelector('.system-workflow__metadata-projection.is-side').getBoundingClientRect();
      const workbenchRect = document.querySelector('[data-presentation-workbench]').getBoundingClientRect();
      const metadataControlsRect = document.querySelector('.system-workflow__metadata-dock-controls').getBoundingClientRect();
      return { board: boardRect.toJSON(), metadataControls: metadataControlsRect.toJSON(),
        panel: panelRect.toJSON(), workbench: workbenchRect.toJSON() };
    });
    assert.ok(resizedSidecarGroup.panel.right <= resizedSidecarGroup.workbench.right + 0.25,
      JSON.stringify(resizedSidecarGroup));
    assert.ok(closeEnough(resizedSidecarGroup.panel.left - resizedSidecarGroup.board.right, 8),
      JSON.stringify(resizedSidecarGroup));
    assert.ok(closeEnough(resizedSidecarGroup.board.width / (resizedSidecarGroup.board.height - 38), 16 / 9, 0.003));

    const placement = page.getByRole('button', { name: /Select ABYSSAL STUDY/ });
    await placement.dblclick();
    await page.waitForFunction(() => document.querySelector('[data-lattice-focus-viewer]')?.dataset.phase === 'open');
    assert.equal(await side.count(), 1);
    assert.equal(await board.getByText('METADATA', { exact: true }).count(), 1);
    const inspectingHeader = await page.evaluate(() => {
      const inspect = document.querySelector('.lattice-focus-viewer__board-controls').getBoundingClientRect();
      const metadata = document.querySelector('.system-workflow__metadata-dock-controls').getBoundingClientRect();
      return { inspect: inspect.toJSON(), metadata: metadata.toJSON() };
    });
    assert.ok(inspectingHeader.inspect.right <= inspectingHeader.metadata.left, JSON.stringify(inspectingHeader));
    assert.ok(closeEnough(inspectingHeader.metadata.left, resizedSidecarGroup.metadataControls.left, 0.25),
      JSON.stringify({ before: resizedSidecarGroup.metadataControls, inspectingHeader }));
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'presentation-board-inspect-metadata-side-wide.png') });
    await page.setViewportSize({ width: 390, height: 720 });
    await page.waitForFunction(() => document.querySelector('.system-workflow')?.dataset.layout === 'narrow');
    const narrowInspectHeader = await page.evaluate(() => {
      const boardRect = document.querySelector('.system-workflow__presentation-board').getBoundingClientRect();
      const controlsRect = document.querySelector('.lattice-focus-viewer__board-controls').getBoundingClientRect();
      return { board: boardRect.toJSON(), controls: controlsRect.toJSON(), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    assert.ok(narrowInspectHeader.controls.left >= narrowInspectHeader.board.left
      && narrowInspectHeader.controls.right <= narrowInspectHeader.board.right, JSON.stringify(narrowInspectHeader));
    assert.equal(narrowInspectHeader.overflow, 0);
    assert.equal(await side.count(), 1);
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'presentation-board-inspect-metadata-side-narrow.png') });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForFunction(() => document.querySelector('.system-workflow')?.dataset.layout === 'wide');
    await page.getByRole('button', { name: 'Open Metadata below Board bar' }).click();
    await side.waitFor({ state: 'detached' });
    await dropdown.waitFor();
    await waitForMetadataMotion();
    assert.equal(await dropdown.count(), 1);
    assert.equal(await board.getByText('METADATA', { exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Close artwork viewer' }).click();
    await page.locator('[data-lattice-focus-viewer]').waitFor({ state: 'detached' });

    await page.getByRole('button', { name: 'Open Metadata beside Presentation Board' }).click();
    await dropdown.waitFor({ state: 'detached' });
    await side.waitFor();
    await waitForMetadataMotion();
    await page.getByRole('button', { name: 'Maximize Presentation Board' }).click();
    await page.waitForFunction(() => document.querySelector('.system-workflow__presentation-board')?.dataset.boardPhase === 'maximized');
    const maximizedSide = await page.evaluate(() => {
      const boardRect = document.querySelector('.system-workflow__presentation-board').getBoundingClientRect();
      const panelRect = document.querySelector('.system-workflow__metadata-projection.is-side').getBoundingClientRect();
      return { board: boardRect.toJSON(), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        panel: panelRect.toJSON() };
    });
    assert.ok(closeEnough(maximizedSide.panel.left - maximizedSide.board.right, 8));
    assert.ok(maximizedSide.panel.right <= 1440);
    assert.equal(maximizedSide.overflow, 0);
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'presentation-board-metadata-side-maximized-wide.png') });
    await page.setViewportSize({ width: 390, height: 720 });
    await page.waitForFunction(() => document.querySelector('.system-workflow')?.dataset.layout === 'narrow');
    const narrowSide = await page.evaluate(() => {
      const boardRect = document.querySelector('.system-workflow__presentation-board').getBoundingClientRect();
      const panelRect = document.querySelector('.system-workflow__metadata-projection.is-side').getBoundingClientRect();
      const titleRect = document.querySelector('.system-workflow__board-title').getBoundingClientRect();
      return { board: boardRect.toJSON(), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        panel: panelRect.toJSON(), title: titleRect.toJSON() };
    });
    assert.ok(narrowSide.board.left >= 0 && narrowSide.panel.right <= 390, JSON.stringify(narrowSide));
    assert.ok(closeEnough(narrowSide.title.right, narrowSide.board.right, 0.25), JSON.stringify(narrowSide));
    assert.equal(narrowSide.overflow, 0);
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'presentation-board-metadata-side-narrow.png') });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForFunction(() => document.querySelector('.system-workflow')?.dataset.layout === 'wide');
    await page.getByRole('button', { name: 'Undock Metadata' }).click();
    const metadata = page.getByRole('complementary', { name: 'Metadata module' });
    await metadata.waitFor();
    await waitForMetadataMotion();
    await page.setViewportSize({ width: 390, height: 720 });
    await page.waitForFunction(() => document.querySelector('.system-workflow')?.dataset.layout === 'narrow');
    const detachedNarrow = await page.evaluate(() => {
      const moduleRect = document.querySelector('.system-workflow__metadata-module[data-floating]').getBoundingClientRect();
      const workbenchRect = document.querySelector('[data-presentation-workbench]').getBoundingClientRect();
      return { module: moduleRect.toJSON(), workbench: workbenchRect.toJSON(), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    assert.ok(detachedNarrow.module.left >= detachedNarrow.workbench.left + 8 - 0.25
      && detachedNarrow.module.right <= detachedNarrow.workbench.right - 8 + 0.25,
    JSON.stringify(detachedNarrow));
    assert.ok(detachedNarrow.module.top >= detachedNarrow.workbench.top + 8 - 0.25
      && detachedNarrow.module.bottom <= detachedNarrow.workbench.bottom - 8 + 0.25,
    JSON.stringify(detachedNarrow));
    assert.equal(detachedNarrow.overflow, 0);
    const narrowPosition = await metadata.boundingBox();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForFunction(() => document.querySelector('.system-workflow')?.dataset.layout === 'wide');
    const restoredWidePosition = await metadata.boundingBox();
    assert.ok(closeEnough(restoredWidePosition.x, narrowPosition.x) && closeEnough(restoredWidePosition.y, narrowPosition.y),
      JSON.stringify({ narrowPosition, restoredWidePosition }));
    await page.getByRole('button', { name: 'Close Metadata' }).click();
    await metadata.waitFor({ state: 'detached' });
    await page.locator('[data-presentation-workbench]').click({ button: 'right', position: { x: 50, y: 80 } });
    await page.getByRole('menuitem', { name: 'ADD' }).focus();
    await page.getByRole('menuitem', { name: 'METADATA MODULE' }).click();
    const readdedMetadata = page.getByRole('complementary', { name: 'Metadata module' });
    await readdedMetadata.waitFor();
    assert.equal(await page.locator('.system-workflow').getAttribute('data-metadata-mode'), 'detached');
    assert.equal(await page.locator('.system-workflow__metadata-module-content').count(), 1);
    await page.getByRole('button', { name: 'Dock Metadata to Presentation Board' }).click();
    await readdedMetadata.waitFor({ state: 'detached' });
    assert.equal(await page.locator('.system-workflow').getAttribute('data-metadata-mode'), 'docked-closed');
    await page.getByRole('button', { name: 'Open Metadata below Board bar' }).click();
    await page.waitForFunction(() => document.querySelector('.system-workflow')?.dataset.metadataMode === 'inner');
    assert.equal(await page.locator('.system-workflow__metadata-module-content').count(), 1);
    await page.getByRole('button', { name: 'Close Metadata below Board bar' }).dblclick({ delay: 10 });
    await page.waitForTimeout(450);
    assert.equal(await page.locator('.system-workflow').getAttribute('data-metadata-mode'), 'inner',
      'two fast toggles are both reduced and return Metadata to its starting mode');
    await page.evaluate(() => {
      for (const label of ['Open Metadata beside Presentation Board', 'Close Metadata below Board bar',
        'Undock Metadata', 'Close Metadata']) {
        document.querySelector(`button[aria-label="${label}"]`)?.click();
      }
    });
    await page.waitForFunction(() => document.querySelector('.system-workflow')?.dataset.metadataMode === 'closed');
    await page.waitForTimeout(180);
    assert.equal(await page.locator('.system-workflow').getAttribute('data-metadata-mode'), 'closed');
    assert.equal(await page.locator('.system-workflow__metadata-module-content').count(), 0);
    if (metadataMotionSupported) {
      const animationFrames = await page.evaluate(() => globalThis.__inscapeMetadataAnimationFrames);
      assert.ok(animationFrames.some((frame) => frame.className === 'system-workflow__metadata-down-host'), JSON.stringify(animationFrames));
      assert.ok(animationFrames.some((frame) => frame.className.includes('system-workflow__metadata-projection is-side')), JSON.stringify(animationFrames));
      assert.ok(animationFrames.some((frame) => frame.className === 'system-workflow__metadata-module'), JSON.stringify(animationFrames));
      assert.ok(animationFrames.some((frame) => frame.duration === 120)
        && animationFrames.some((frame) => frame.duration === 160), JSON.stringify(animationFrames));
      const fadeFrames = animationFrames.filter((frame) => frame.duration === 120 || frame.duration === 160);
      assert.ok(fadeFrames.every((frame) => frame.keyframes.every((keyframe) => keyframe.transform === undefined)), JSON.stringify(animationFrames));
      assert.equal(await page.evaluate(() => globalThis.__inscapeMetadataViewTransitionCount), 0);
    }
  } finally {
    await browser.close();
  }
});

test.skip('legacy inspection-to-immediate-restore contract replaced by persistent maximized Board', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));
    await page.goto(URL, { waitUntil: 'networkidle' });
    await setSlider(page, 30);

    const board = page.locator('.system-workflow__presentation-board');
    const header = board.locator('.system-workflow__identity-strip');
    const handle = await header.boundingBox();
    await page.mouse.move(handle.x + 60, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + 150, handle.y + 90, { steps: 4 });
    await page.mouse.up();
    const saved = await board.boundingBox();
    const placement = page.getByRole('button', { name: /Select ABYSSAL STUDY/ });
    await placement.click();
    await placement.dblclick();

    await page.waitForFunction(() => document.querySelector('.system-workflow__presentation-board')?.dataset.inspectionPhase === 'inspecting');
    await page.waitForFunction(() => document.querySelector('[data-lattice-focus-viewer]')?.dataset.phase === 'open');
    const slider = page.getByRole('slider', { name: 'Board zoom' });
    assert.equal(await slider.inputValue(), '30');
    assert.equal(await slider.isDisabled(), true);
    assert.equal(await page.getByText('INSPECT', { exact: true }).count(), 1);
    const contained = await page.evaluate(() => {
      const boardNode = document.querySelector('.system-workflow__presentation-board');
      const hostNode = boardNode.querySelector('.system-workflow__board-inspection-host');
      const viewerNode = hostNode.querySelector('.lattice-focus-viewer');
      const boardRect = boardNode.getBoundingClientRect();
      const hostRect = hostNode.getBoundingClientRect();
      const viewerRect = viewerNode.getBoundingClientRect();
      return {
        board: { bottom: boardRect.bottom, left: boardRect.left, right: boardRect.right, top: boardRect.top },
        host: { bottom: hostRect.bottom, left: hostRect.left, right: hostRect.right, top: hostRect.top },
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        parentIsHost: viewerNode.parentElement === hostNode,
        position: getComputedStyle(viewerNode).position,
        viewer: { bottom: viewerRect.bottom, left: viewerRect.left, right: viewerRect.right, top: viewerRect.top },
      };
    });
    assert.equal(contained.parentIsHost, true);
    assert.equal(contained.position, 'absolute');
    assert.ok(contained.viewer.left >= contained.host.left && contained.viewer.right <= contained.host.right);
    assert.ok(contained.viewer.top >= contained.host.top && contained.viewer.bottom <= contained.host.bottom);
    assert.ok(contained.board.left > 0 && contained.board.top > 0 && contained.board.right < 1440 && contained.board.bottom < 858);
    assert.equal(contained.overflowX, 0);
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'presentation-board-inspect-wide.png') });

    const metadataRack = page.locator('.lattice-focus-viewer__rack');
    const initialMetadata = await metadataRack.textContent();
    await page.getByRole('button', { name: 'Next artwork' }).click();
    await page.waitForFunction((previous) => document.querySelector('.lattice-focus-viewer__rack')?.textContent !== previous,
      initialMetadata);
    assert.notEqual(await metadataRack.textContent(), initialMetadata);
    await page.waitForFunction(() => document.querySelector('[aria-label="Next artwork"]')?.getAttribute('aria-disabled') !== 'true');

    await page.getByRole('button', { name: 'Close artwork viewer' }).click();
    await page.waitForFunction(() => document.querySelector('.system-workflow__presentation-board')?.dataset.inspectionPhase === 'idle');
    const restoredByX = await board.boundingBox();
    assert.ok(closeEnough(restoredByX.x, saved.x) && closeEnough(restoredByX.y, saved.y), JSON.stringify({ restoredByX, saved }));
    assert.ok(closeEnough(restoredByX.width, saved.width) && closeEnough(restoredByX.height, saved.height), JSON.stringify({ restoredByX, saved }));
    assert.equal(await slider.inputValue(), '30');
    assert.equal(await slider.isEnabled(), true);
    assert.equal(await placement.getAttribute('aria-pressed'), 'true');

    await placement.dblclick();
    await page.waitForFunction(() => document.querySelector('.system-workflow__presentation-board')?.dataset.inspectionPhase === 'inspecting');
    await page.waitForFunction(() => document.querySelector('[data-lattice-focus-viewer]')?.dataset.phase === 'open');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('.system-workflow__presentation-board')?.dataset.inspectionPhase === 'idle');
    const restoredByEscape = await board.boundingBox();
    assert.ok(closeEnough(restoredByEscape.x, saved.x) && closeEnough(restoredByEscape.y, saved.y), JSON.stringify({ restoredByEscape, saved }));
    assert.ok(closeEnough(restoredByEscape.width, saved.width) && closeEnough(restoredByEscape.height, saved.height), JSON.stringify({ restoredByEscape, saved }));
    assert.equal(await slider.inputValue(), '30');
    assert.equal(await placement.getAttribute('aria-pressed'), 'true');

    await placement.dblclick();
    await page.waitForFunction(() => document.querySelector('.system-workflow__presentation-board')?.dataset.inspectionPhase === 'focusing');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('.system-workflow__presentation-board')?.dataset.inspectionPhase === 'idle');
    const restoredAfterFastCancel = await board.boundingBox();
    assert.ok(closeEnough(restoredAfterFastCancel.x, saved.x) && closeEnough(restoredAfterFastCancel.y, saved.y),
      JSON.stringify({ restoredAfterFastCancel, saved }));
    assert.equal(await slider.inputValue(), '30');

    await page.setViewportSize({ width: 390, height: 720 });
    await page.waitForFunction(() => document.querySelector('.system-workflow')?.dataset.layout === 'narrow');
    const narrowPlacement = page.getByRole('button', { name: /Select ABYSSAL STUDY/ });
    await narrowPlacement.dblclick();
    await page.waitForFunction(() => document.querySelector('.system-workflow__presentation-board')?.dataset.inspectionPhase === 'inspecting');
    await page.waitForFunction(() => document.querySelector('[data-lattice-focus-viewer]')?.dataset.phase === 'open');
    const narrow = await page.evaluate(() => {
      const artwork = document.querySelector('.lattice-focus-viewer__artwork').getBoundingClientRect();
      const rack = document.querySelector('.lattice-focus-viewer__rack').getBoundingClientRect();
      const viewer = document.querySelector('.lattice-focus-viewer').getBoundingClientRect();
      return {
        artworkBottom: artwork.bottom,
        layout: document.querySelector('.lattice-focus-viewer').dataset.layout,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        rackTop: rack.top,
        viewerWidth: viewer.width,
      };
    });
    assert.equal(narrow.layout, 'rack-compact');
    assert.ok(narrow.rackTop >= narrow.artworkBottom, JSON.stringify(narrow));
    assert.equal(narrow.overflowX, 0);
    assert.ok(narrow.viewerWidth <= 390);
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'presentation-board-inspect-narrow.png') });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('.system-workflow__presentation-board')?.dataset.inspectionPhase === 'idle');
    assert.equal(await slider.inputValue(), '30');
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
  }
});

test('Presentation Board resizes from its corners and preserves exact maximize, restore, and shortcut state', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));
    await page.goto(URL, { waitUntil: 'networkidle' });
    assert.equal(await page.getByRole('slider', { name: 'Board zoom' }).count(), 0);

    const board = page.locator('.system-workflow__presentation-board');
    const stage = page.locator('[data-presentation-stage]');
    assert.equal(await board.getAttribute('data-scale-rendering'), 'settled');
    const settledSampling = await stage.evaluate((node) => ({
      scale: Number(node.closest('.system-workflow__presentation-board').dataset.boardScale),
      transform: getComputedStyle(node).transform,
      viewport: node.parentElement.getBoundingClientRect().toJSON(),
      stage: node.getBoundingClientRect().toJSON(),
    }));
    assert.equal(settledSampling.transform, 'none', JSON.stringify(settledSampling));
    assert.ok(settledSampling.stage.width >= settledSampling.viewport.width, JSON.stringify(settledSampling));
    assert.ok(settledSampling.stage.width - settledSampling.viewport.width < 1, JSON.stringify(settledSampling));
    assert.ok(settledSampling.stage.height >= settledSampling.viewport.height, JSON.stringify(settledSampling));
    assert.ok(settledSampling.stage.height - settledSampling.viewport.height < 1, JSON.stringify(settledSampling));
    const identityMediaTransforms = await page.locator('.system-workflow__placement img').evaluateAll((nodes) =>
      nodes.map((node) => getComputedStyle(node).transform));
    assert.ok(identityMediaTransforms.includes('none'), JSON.stringify(identityMediaTransforms));
    const manualResizeTransitions = await page.locator('.system-workflow__stage-viewport')
      .evaluate((node) => getComputedStyle(node).transitionProperty.split(',').map((value) => value.trim()));
    assert.equal(manualResizeTransitions.includes('height'), false, JSON.stringify(manualResizeTransitions));
    const initial = await board.boundingBox();
    const placementsBeforeHold = await page.locator('.system-workflow__placement').evaluateAll((nodes) => nodes.map((node) => {
      const rectangle = node.getBoundingClientRect();
      return { height: rectangle.height, left: rectangle.left, top: rectangle.top, width: rectangle.width };
    }));
    const southEast = page.getByRole('button', { name: 'Resize Presentation Board from se' });
    const handle = await southEast.boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.waitForFunction(() => document.querySelector('.system-workflow__presentation-board')?.dataset.scaleRendering === 'live');
    const placementsWhileHeld = await page.locator('.system-workflow__placement').evaluateAll((nodes) => nodes.map((node) => {
      const rectangle = node.getBoundingClientRect();
      return { height: rectangle.height, left: rectangle.left, top: rectangle.top, width: rectangle.width };
    }));
    assert.deepEqual(placementsWhileHeld, placementsBeforeHold);
    const liveSampling = await stage.evaluate((node) => ({
      transform: getComputedStyle(node).transform,
      zoom: Number(getComputedStyle(node).zoom),
    }));
    assert.notEqual(liveSampling.transform, 'none', JSON.stringify(liveSampling));
    assert.equal(liveSampling.zoom, 1, JSON.stringify(liveSampling));
    await page.mouse.move(handle.x + handle.width / 2 + 1, handle.y + handle.height / 2 + 1);
    const firstPixel = await board.boundingBox();
    await page.mouse.move(handle.x + handle.width / 2 + 2, handle.y + handle.height / 2 + 2);
    const secondPixel = await board.boundingBox();
    assert.ok(firstPixel.width > initial.width, JSON.stringify({ initial, firstPixel }));
    assert.ok(secondPixel.width > firstPixel.width, JSON.stringify({ firstPixel, secondPixel }));
    assert.ok(secondPixel.width - firstPixel.width < 2, JSON.stringify({ firstPixel, secondPixel }));
    await page.mouse.move(handle.x + 360, handle.y + 200, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelector('.system-workflow__presentation-board')?.dataset.scaleRendering === 'settled');
    const resizedSampling = await stage.evaluate((node) => ({
      scale: Number(node.closest('.system-workflow__presentation-board').dataset.boardScale),
      transform: getComputedStyle(node).transform,
      viewport: node.parentElement.getBoundingClientRect().toJSON(),
      stage: node.getBoundingClientRect().toJSON(),
    }));
    assert.equal(resizedSampling.transform, 'none', JSON.stringify(resizedSampling));
    assert.ok(resizedSampling.stage.width >= resizedSampling.viewport.width, JSON.stringify(resizedSampling));
    assert.ok(resizedSampling.stage.width - resizedSampling.viewport.width < 1, JSON.stringify(resizedSampling));
    assert.ok(resizedSampling.stage.height >= resizedSampling.viewport.height, JSON.stringify(resizedSampling));
    assert.ok(resizedSampling.stage.height - resizedSampling.viewport.height < 1, JSON.stringify(resizedSampling));
    const resized = await board.boundingBox();
    assert.ok(resized.width > initial.width + 300, JSON.stringify({ initial, resized }));
    assert.ok(closeEnough((resized.height - 38) / resized.width, 9 / 16, 0.003));

    await page.getByRole('button', { name: 'Maximize Presentation Board' }).click();
    await page.waitForFunction(() => document.querySelector('.system-workflow__presentation-board')?.dataset.boardPhase === 'maximized');
    const maximized = await board.boundingBox();
    assert.ok(maximized.width > resized.width);
    assert.equal(await page.getByRole('button', { name: 'Restore Presentation Board' }).count(), 1);
    await page.getByRole('button', { name: 'Restore Presentation Board' }).click();
    await page.waitForFunction(() => document.querySelector('.system-workflow__presentation-board')?.dataset.boardPhase === 'window');
    const restored = await board.boundingBox();
    assert.ok(closeEnough(restored.x, resized.x) && closeEnough(restored.y, resized.y), JSON.stringify({ resized, restored }));
    assert.ok(closeEnough(restored.width, resized.width) && closeEnough(restored.height, resized.height), JSON.stringify({ resized, restored }));

    await page.getByRole('button', { name: 'Close Presentation Board to shortcut' }).click();
    await board.waitFor({ state: 'detached' });
    const shortcut = page.getByRole('button', { name: 'Open PRESENTATION BOARD' });
    await shortcut.waitFor();
    await shortcut.dblclick();
    await board.waitFor();
    const reopened = await board.boundingBox();
    assert.ok(closeEnough(reopened.width, resized.width) && closeEnough(reopened.height, resized.height), JSON.stringify({ reopened, resized }));
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'presentation-board-desktop-wide.png') });
    await page.setViewportSize({ width: 759, height: 720 });
    await page.waitForFunction(() => document.querySelector('.system-workflow')?.dataset.layout === 'narrow');
    const beforeResponsiveBoundary = await board.boundingBox();
    await page.setViewportSize({ width: 761, height: 720 });
    await page.waitForFunction(() => document.querySelector('.system-workflow')?.dataset.layout === 'compact');
    const afterResponsiveBoundary = await board.boundingBox();
    assert.ok(Math.abs(afterResponsiveBoundary.width - beforeResponsiveBoundary.width) < 10,
      JSON.stringify({ beforeResponsiveBoundary, afterResponsiveBoundary }));
    assert.ok(Math.abs(afterResponsiveBoundary.x - beforeResponsiveBoundary.x) < 10,
      JSON.stringify({ beforeResponsiveBoundary, afterResponsiveBoundary }));
    await page.setViewportSize({ width: 390, height: 720 });
    await page.waitForFunction(() => document.querySelector('.system-workflow')?.dataset.layout === 'narrow');
    const narrowBoard = await board.boundingBox();
    assert.ok(narrowBoard.x >= 0 && narrowBoard.y >= 0 && narrowBoard.x + narrowBoard.width <= 390);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'presentation-board-desktop-narrow.png') });
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
  }
});

test('artwork-only view stays inside the Board without changing its current size', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));
    await page.goto(URL, { waitUntil: 'networkidle' });
    const board = page.locator('.system-workflow__presentation-board');
    const placement = page.getByRole('button', { name: /Select ABYSSAL STUDY/ });
    await placement.dblclick();
    await page.waitForFunction(() => document.querySelector('[data-lattice-focus-viewer]')?.dataset.phase === 'open');
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'presentation-board-artwork-only-default-wide.png') });
    await page.getByRole('button', { name: 'Close artwork viewer' }).click();
    assert.equal(await board.getAttribute('data-inspection-atmosphere'), null);
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.system-workflow__stage-viewport').evaluate((node) => getComputedStyle(node).filter), 'none');
    await page.waitForFunction(() => document.querySelector('.system-workflow__placement[data-viewing]') === null);
    assert.equal(await placement.evaluate((node) => getComputedStyle(node).filter), 'none');
    await page.locator('[data-lattice-focus-viewer]').waitFor({ state: 'detached' });

    const southEast = page.getByRole('button', { name: 'Resize Presentation Board from se' });
    const resizeHandle = await southEast.boundingBox();
    await page.mouse.move(resizeHandle.x + resizeHandle.width / 2, resizeHandle.y + resizeHandle.height / 2);
    await page.mouse.down();
    await page.mouse.move(resizeHandle.x - 500, resizeHandle.y - 300, { steps: 8 });
    await page.mouse.up();
    const saved = await board.boundingBox();
    assert.equal(await board.getAttribute('data-board-scale'), '0.25');

    await placement.dblclick();
    await page.waitForFunction(() => document.querySelector('[data-lattice-focus-viewer]')?.dataset.phase === 'open');
    const inspecting = await board.boundingBox();
    assert.equal(await board.getAttribute('data-board-phase'), 'window');
    assert.ok(closeEnough(inspecting.x, saved.x) && closeEnough(inspecting.y, saved.y), JSON.stringify({ inspecting, saved }));
    assert.ok(closeEnough(inspecting.width, saved.width) && closeEnough(inspecting.height, saved.height), JSON.stringify({ inspecting, saved }));
    assert.equal(await page.locator('.lattice-focus-viewer__rack').count(), 0);
    assert.equal(await page.locator('.lattice-focus-viewer__dossier').count(), 0);
    assert.equal(await page.locator('.lattice-focus-viewer__navigation').count(), 0);
    assert.equal(await page.locator('.lattice-focus-viewer__close-control').count(), 0);
    assert.equal(await page.locator('.lattice-focus-viewer__board-controls').count(), 1);
    assert.equal(await page.locator('.lattice-focus-viewer__board-controls > span').textContent(), '01 / 02');
    assert.equal(await page.locator('[data-lattice-focus-viewer]').getAttribute('data-layout'), 'isolated');
    const atmosphere = await page.evaluate(() => ({
      backdrop: getComputedStyle(document.querySelector('.lattice-focus-viewer__surface')).backgroundColor,
      compositionFilter: getComputedStyle(document.querySelector('.system-workflow__stage-viewport')).filter,
      sourceVisibility: getComputedStyle(document.querySelector('.system-workflow__placement[data-viewing]')).visibility,
    }));
    assert.notEqual(atmosphere.compositionFilter, 'none');
    assert.match(atmosphere.backdrop, /rgba\(5, 6, 6, 0\.18\)/);
    assert.equal(atmosphere.sourceVisibility, 'hidden');
    const contained = await page.evaluate(() => {
      const host = document.querySelector('.system-workflow__board-inspection-host').getBoundingClientRect();
      const artwork = document.querySelector('.lattice-focus-viewer__artwork').getBoundingClientRect();
      return { artwork, host, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    assert.ok(contained.artwork.left >= contained.host.left && contained.artwork.right <= contained.host.right);
    assert.ok(contained.artwork.top >= contained.host.top && contained.artwork.bottom <= contained.host.bottom);
    assert.ok(contained.artwork.height >= contained.host.height - 42, JSON.stringify(contained));
    assert.equal(contained.overflow, 0);
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'presentation-board-artwork-only-wide.png') });

    await page.locator('.lattice-focus-viewer__artwork').click();
    await page.waitForFunction(() => document.querySelector('.lattice-focus-viewer__board-controls > span')?.textContent === '02 / 02');
    assert.equal(await board.getByText('INSPECT', { exact: true }).count(), 1);
    assert.equal(await board.getByText('METADATA', { exact: true }).count(), 1);
    await page.waitForFunction(() => !document.querySelector('.lattice-focus-viewer__browse-layer'));

    await page.getByRole('button', { name: 'Close artwork viewer' }).click();
    await page.locator('[data-lattice-focus-viewer]').waitFor({ state: 'detached' });
    const restored = await board.boundingBox();
    assert.ok(closeEnough(restored.x, saved.x) && closeEnough(restored.y, saved.y), JSON.stringify({ restored, saved }));
    assert.ok(closeEnough(restored.width, saved.width) && closeEnough(restored.height, saved.height), JSON.stringify({ restored, saved }));
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
  }
});

test('Workbench ADD commands follow canonical Board and Metadata lifecycle state', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(URL, { waitUntil: 'networkidle' });
    const workbench = page.locator('[data-presentation-workbench]');
    const board = page.getByRole('article', { name: 'Presentation Board' });
    assert.equal(await page.locator('.system-workflow').getAttribute('data-board-instance-state'), 'window');
    await workbench.click({ button: 'right', position: { x: 920, y: 540 } });
    await page.getByRole('menuitem', { name: 'ADD' }).focus();
    assert.equal(await page.getByRole('menuitem', { name: 'PRESENTATION BOARD' }).isDisabled(), true);
    assert.equal(await page.getByRole('menuitem', { name: 'METADATA MODULE' }).isDisabled(), true);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Close Presentation Board to shortcut' }).click();
    await board.waitFor({ state: 'detached' });
    const shortcut = page.getByRole('button', { name: 'Open PRESENTATION BOARD' });
    await shortcut.waitFor();
    assert.equal(await page.locator('.system-workflow').getAttribute('data-board-instance-state'), 'minimized');
    await workbench.click({ button: 'right', position: { x: 920, y: 540 } });
    await page.getByRole('menuitem', { name: 'ADD' }).focus();
    assert.equal(await page.getByRole('menuitem', { name: 'PRESENTATION BOARD' }).isDisabled(), true);
    await page.keyboard.press('Escape');
    await shortcut.dblclick();
    await board.waitFor();
    assert.equal(await page.locator('.system-workflow').getAttribute('data-board-instance-state'), 'window');

    await page.getByRole('button', { name: 'Close Metadata' }).click();
    assert.equal(await page.locator('.system-workflow').getAttribute('data-metadata-mode'), 'closed');
    await workbench.click({ button: 'right', position: { x: 920, y: 540 } });
    await page.getByRole('menuitem', { name: 'ADD' }).focus();
    assert.equal(await page.getByRole('menuitem', { name: 'METADATA MODULE' }).isDisabled(), false);
    assert.equal(await page.getByRole('menuitem', { name: 'PRESENTATION BOARD' }).isDisabled(), true);
    await page.getByRole('menuitem', { name: 'METADATA MODULE' }).click();
    assert.equal(await page.getByRole('complementary', { name: 'Metadata module' }).count(), 1);
    assert.equal(await page.locator('.system-workflow__metadata-module-content').count(), 1);
  } finally {
    await browser.close();
  }
});

test('Workbench shortcut snaps, renames, and accepts a Library artwork as its icon', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    if (SCREENSHOT_DIR) await mkdir(SCREENSHOT_DIR, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Close Presentation Board to shortcut' }).click();
    let shortcut = page.locator('.system-workflow__desktop-shortcut');
    const before = await shortcut.boundingBox();
    await page.mouse.move(before.x + before.width / 2, before.y + 10);
    await page.mouse.down();
    await page.mouse.move(before.x + before.width / 2 + 51, before.y + 47, { steps: 4 });
    await page.mouse.up();
    const moved = await shortcut.boundingBox();
    assert.equal(moved.x % 24, 0);
    assert.equal(moved.y % 24, 0);

    await shortcut.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'RENAME' }).click();
    const input = page.getByRole('textbox', { name: 'Presentation Board shortcut name' });
    await input.fill('CURATED NFTs');
    await input.press('Enter');
    shortcut = page.getByRole('button', { name: 'Open CURATED NFTs' });
    await shortcut.waitFor();

    await page.getByRole('button', { name: 'LIBRARY' }).click();
    const firstAsset = page.locator('.lattice-browser-asset').first();
    await firstAsset.waitFor();
    assert.equal(await firstAsset.getAttribute('draggable'), 'true');
    await page.evaluate(() => {
      const source = document.querySelector('.lattice-browser-asset');
      const target = document.querySelector('.system-workflow__desktop-shortcut');
      const transfer = new DataTransfer();
      source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    });
    assert.equal(await shortcut.locator('.system-workflow__desktop-shortcut-icon img').count() > 0, true);
    const customIcon = shortcut.locator('.system-workflow__desktop-shortcut-icon');
    assert.deepEqual(await customIcon.evaluate((node) => {
      const rectangle = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        background: style.backgroundColor,
        border: style.borderTopWidth,
        custom: node.dataset.custom,
        height: rectangle.height,
        objectFit: getComputedStyle(node.querySelector('img')).objectFit,
        width: rectangle.width,
      };
    }), { background: 'rgba(0, 0, 0, 0)', border: '0px', custom: 'true', height: 60, objectFit: 'contain', width: 60 });

    await page.getByRole('button', { name: 'Close workspace' }).click();
    await shortcut.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'EDIT ICON' }).click();
    const iconEditor = page.getByRole('dialog', { name: 'Edit Presentation Board shortcut icon' });
    await iconEditor.waitFor();
    await iconEditor.getByRole('slider', { name: 'Shortcut icon size' }).fill('140');
    await iconEditor.getByRole('slider', { name: 'Shortcut icon zoom' }).fill('2');
    await iconEditor.getByRole('slider', { name: 'Shortcut icon horizontal position' }).fill('7');
    await iconEditor.getByRole('slider', { name: 'Shortcut icon vertical position' }).fill('-5');
    await iconEditor.getByRole('slider', { name: 'Shortcut label size' }).fill('11');
    assert.match(await customIcon.locator('img').first().getAttribute('style'), /translate\(7px, -5px\) scale\(2\)/);
    assert.deepEqual(await customIcon.evaluate((node) => {
      const rectangle = node.getBoundingClientRect();
      return { height: rectangle.height, width: rectangle.width };
    }), { height: 140, width: 140 });
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'presentation-board-shortcut-icon-editor-wide.png') });
    await page.waitForFunction(() => {
      const key = Object.keys(localStorage).find((candidate) => candidate.startsWith('inscape:workbench:presentation-board:'));
      const stored = key && JSON.parse(localStorage.getItem(key));
      return stored?.iconPresentation?.scale === 2 && stored.iconPresentation.size === 140
        && stored.iconPresentation.labelSize === 11
        && stored.iconPresentation.offsetX === 7 && stored.iconPresentation.offsetY === -5;
    });
    await iconEditor.getByRole('button', { name: 'DONE' }).click();
    await page.reload({ waitUntil: 'networkidle' });
    shortcut = page.getByRole('button', { name: 'Open CURATED NFTs' });
    await shortcut.waitFor();
    assert.match(await shortcut.locator('.system-workflow__desktop-shortcut-icon img').first().getAttribute('style'),
      /translate\(7px, -5px\) scale\(2\)/);
    assert.equal((await shortcut.locator('.system-workflow__desktop-shortcut-icon').boundingBox()).width, 140);
    const shortcutPositionBeforeOpen = await shortcut.boundingBox();
    await shortcut.dblclick();
    const board = page.getByRole('article', { name: 'Presentation Board' });
    await board.waitFor();
    assert.equal(await page.locator('.system-workflow__desktop-shortcut').count(), 1,
      'the desktop shortcut remains visible while its Presentation Board is open');
    const boardHeader = await board.locator('.system-workflow__identity-strip').boundingBox();
    await page.mouse.move(boardHeader.x + 90, boardHeader.y + boardHeader.height / 2);
    await page.mouse.down();
    await page.mouse.move(boardHeader.x + 190, boardHeader.y + boardHeader.height / 2 + 80, { steps: 4 });
    await page.mouse.up();
    await page.getByRole('button', { name: 'Close Presentation Board to shortcut' }).click();
    shortcut = page.getByRole('button', { name: 'Open CURATED NFTs' });
    await shortcut.waitFor();
    const shortcutPositionAfterClose = await shortcut.boundingBox();
    assert.ok(closeEnough(shortcutPositionAfterClose.x, shortcutPositionBeforeOpen.x)
      && closeEnough(shortcutPositionAfterClose.y, shortcutPositionBeforeOpen.y),
    JSON.stringify({ shortcutPositionAfterClose, shortcutPositionBeforeOpen }));
    await page.setViewportSize({ width: 390, height: 720 });
    await shortcut.click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'EDIT ICON' }).click();
    const narrowEditor = page.getByRole('dialog', { name: 'Edit Presentation Board shortcut icon' });
    await narrowEditor.waitFor();
    const narrowEditorBox = await narrowEditor.boundingBox();
    const narrowEditorGeometry = await narrowEditor.evaluate((node) => ({
      computedLeft: getComputedStyle(node).left,
      host: node.closest('.system-workflow__workbench').getBoundingClientRect().toJSON(),
      inlineLeft: node.style.left,
      offsetParent: node.offsetParent?.getBoundingClientRect().toJSON(),
      position: getComputedStyle(node).position,
      transform: getComputedStyle(node).transform,
      translate: getComputedStyle(node).translate,
      viewportWidth: globalThis.innerWidth,
    }));
    assert.ok(narrowEditorBox.x >= 8 && narrowEditorBox.x + narrowEditorBox.width <= 382,
      JSON.stringify({ box: narrowEditorBox, ...narrowEditorGeometry }));
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'presentation-board-shortcut-icon-editor-narrow.png') });
  } finally {
    await browser.close();
  }
});
