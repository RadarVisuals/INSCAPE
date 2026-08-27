import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
const SCREENSHOT_DIR = process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR ? resolve(process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR) : null;

test('accepted icon rail and layers operate through canonical commands', { timeout: 60_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    if (SCREENSHOT_DIR) await mkdir(SCREENSHOT_DIR, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${ROOT}/development/owner/system-workflow`, { waitUntil: 'networkidle' });
    await page.evaluate(() => { window.__workflowWrites = 0; addEventListener('inscape:review-storage-write', () => { window.__workflowWrites += 1; }); });
    await page.getByRole('button', { name: /Select ABYSSAL STUDY/ }).click();
    const inspector = page.getByRole('complementary', { name: 'Selection and layers inspector' });
    const rect = await inspector.boundingBox();
    assert.equal(rect.width, 402);
    assert.ok(rect.height >= 170 && rect.height <= 205, `unexpected inspector height ${rect.height}`);
    assert.equal(Math.round(rect.x), 1026);
    assert.equal(Math.round(rect.y + rect.height), 846);
    assert.equal(await inspector.getByRole('navigation', { name: 'Selection actions' }).getByRole('button').count(), 10);
    assert.equal(await inspector.locator('.system-workflow__layer-row').count(), 2);
    assert.equal(await inspector.locator('.system-workflow__layer-row[data-selected]').count(), 1);
    const selectedRowActions = inspector.locator('.system-workflow__layer-row[data-selected] > button');
    const selectedRowActionCount = await selectedRowActions.count();
    assert.match(await selectedRowActions.nth(selectedRowActionCount - 2).getAttribute('aria-label'), /^Lock /,
      'lock precedes the final destructive layer action');
    assert.match(await selectedRowActions.nth(selectedRowActionCount - 1).getAttribute('aria-label'), /^Remove /,
      'remove remains the final layer action');
    assert.equal(await inspector.getByRole('button', { name: 'Lock ABYSSAL STUDY', exact: true }).getAttribute('aria-pressed'), 'false');
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'review-inspector-1440x900.png') });

    await page.evaluate(() => { window.__workflowWrites = 0; });
    await page.getByRole('button', { name: 'Rotate', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__workflowWrites), 1);
    assert.match(await page.getByRole('button', { name: /Select ABYSSAL STUDY/ }).locator('img').getAttribute('style'), /90deg/);
    await page.evaluate(() => { window.__workflowWrites = 0; });
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
    assert.equal(await page.evaluate(() => window.__workflowWrites), 1);
    assert.equal(await page.locator('.system-workflow__placement').count(), 3);
    assert.equal(await inspector.locator('.system-workflow__layer-row').count(), 3);
    assert.equal(await inspector.locator('.system-workflow__layer-row[data-selected]').count(), 1, 'the new duplicate becomes the active selection');

    const duplicateRow = inspector.locator('.system-workflow__layer-row').first();
    await duplicateRow.getByRole('button', { name: /Remove ABYSSAL STUDY from Grid/ }).click();
    assert.equal(await duplicateRow.getByText(/Remove from Grid\?/i).isVisible(), true);
    await duplicateRow.getByRole('button', { name: /^Cancel$/i }).click();
    assert.equal(await duplicateRow.getByText(/Remove from Grid\?/i).count(), 0);
    await duplicateRow.getByRole('button', { name: /Remove ABYSSAL STUDY from Grid/ }).click();
    await page.evaluate(() => { window.__workflowWrites = 0; });
    await duplicateRow.getByRole('button', { name: /^Remove$/i }).click();
    assert.equal(await page.evaluate(() => window.__workflowWrites), 1);
    assert.equal(await page.locator('.system-workflow__placement').count(), 2);

    await page.getByRole('button', { name: /Select ABYSSAL STUDY/ }).click();
    await page.getByRole('button', { name: 'Frame and mat', exact: true }).click();
    assert.equal(await page.getByRole('region', { name: 'Frame and mat controls' }).isVisible(), true);
    await page.getByRole('button', { name: /^Cancel$/i }).click();

    const mountain = page.getByRole('button', { name: /Select MOUNTAIN SIGNAL II/ });
    await mountain.click();
    assert.deepEqual(await mountain.evaluate((node) => ({
      outlineStyle: getComputedStyle(node).outlineStyle,
      pointerFocus: node.hasAttribute('data-system-workflow-pointer-focus'),
    })), { outlineStyle: 'none', pointerFocus: true },
    'ordinary pointer selection does not paint a native placement outline');
    await page.getByRole('button', { name: 'Rotate', exact: true }).click();
    const rotatedEdgeOffsets = () => mountain.evaluate((node) => {
      const placement = node.getBoundingClientRect();
      const image = node.querySelector('img').getBoundingClientRect();
      return {
        left: image.left - placement.left,
        right: placement.right - image.right,
        usesPixels: node.querySelector('img').style.left.endsWith('px'),
      };
    });
    const rotatedRowA = await rotatedEdgeOffsets();
    assert.deepEqual(rotatedRowA, { left: 0, right: 0, usesPixels: true },
      'rotated media shares the placement pixel edges');
    await page.keyboard.press('ArrowUp');
    const rotatedRowB = await rotatedEdgeOffsets();
    assert.deepEqual(rotatedRowB, rotatedRowA,
      'rotated media keeps identical edge coverage after crossing a differently rounded Grid row');

    const rotatedSourceRatio = await mountain.locator('img').evaluate((image) => {
      const rectangle = image.getBoundingClientRect();
      return rectangle.width / rectangle.height;
    });
    await mountain.dblclick();
    const openingSamples = await page.evaluate(async () => new Promise((resolveSamples) => {
      const samples = [];
      const sample = () => {
        const viewer = document.querySelector('[data-lattice-focus-viewer]');
        const image = viewer?.querySelector('.lattice-production-focus-artwork__media');
        if (image) {
          const rectangle = image.getBoundingClientRect();
          const artwork = viewer.querySelector('.lattice-focus-viewer__artwork').getBoundingClientRect();
          if (rectangle.width > 0 && rectangle.height > 0) samples.push({
            artworkLeft: artwork.left,
            imageLeft: rectangle.left,
            phase: viewer.dataset.phase,
            ratio: rectangle.width / rectangle.height,
          });
        }
        if (!viewer || (viewer.dataset.phase === 'open' && samples.length >= 3)) resolveSamples(samples);
        else requestAnimationFrame(sample);
      };
      sample();
    }));
    const openingRatios = openingSamples.map(({ ratio }) => ratio);
    assert.ok(openingRatios.length >= 3, 'rotated viewer opening exposes a measurable geometry sequence');
    openingRatios.forEach((ratio) => assert.ok(Math.abs(ratio - rotatedSourceRatio) < 0.002,
      `rotated viewer opening stretched media from ${rotatedSourceRatio} to ${ratio}`));
    const lastOpeningSample = openingSamples.findLast(({ phase }) => phase === 'opening');
    const stableOpenSample = openingSamples.find(({ phase }) => phase === 'open');
    assert.ok(lastOpeningSample && stableOpenSample, 'viewer exposes both final opening and stable open geometry');
    assert.ok(Math.abs(lastOpeningSample.artworkLeft - stableOpenSample.artworkLeft) < 0.01,
      `viewer artwork handoff shifted ${JSON.stringify({ lastOpeningSample, stableOpenSample })}`);
    assert.ok(Math.abs(lastOpeningSample.imageLeft - stableOpenSample.imageLeft) < 0.01,
      `viewer media handoff shifted ${JSON.stringify({ lastOpeningSample, stableOpenSample })}`);
    assert.equal(await page.getByRole('dialog', { name: 'MOUNTAIN SIGNAL II focus viewer' }).evaluate((node) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
        acceptNode: (text) => text.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
      });
      const text = walker.nextNode();
      const selection = globalThis.getSelection();
      if (!text || !selection) return false;
      const range = document.createRange();
      range.selectNodeContents(text);
      selection.removeAllRanges();
      selection.addRange(range);
      return selection.rangeCount === 1 && selection.toString().length > 0;
    }), true, 'viewer text remains natively selectable while open');
    await page.getByRole('button', { name: 'Close artwork viewer' }).click();
    assert.equal(await page.evaluate(() => globalThis.getSelection()?.rangeCount || 0), 0,
      'viewer close clears native text selection before its geometry transition');
    const closingRatios = await page.evaluate(async () => new Promise((resolveRatios) => {
      const ratios = [];
      const sample = () => {
        const viewer = document.querySelector('[data-lattice-focus-viewer]');
        const image = viewer?.querySelector('.lattice-production-focus-artwork__media');
        if (image) {
          const rectangle = image.getBoundingClientRect();
          if (rectangle.width > 0 && rectangle.height > 0) ratios.push(rectangle.width / rectangle.height);
        }
        if (!viewer) resolveRatios(ratios);
        else requestAnimationFrame(sample);
      };
      sample();
    }));
    assert.ok(closingRatios.length >= 3, 'rotated viewer closing exposes a measurable geometry sequence');
    closingRatios.forEach((ratio) => assert.ok(Math.abs(ratio - rotatedSourceRatio) < 0.002,
      `rotated viewer closing stretched media from ${rotatedSourceRatio} to ${ratio}`));
    const returnedFocus = await mountain.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        active: document.activeElement === node,
        focusVisible: node.matches(':focus-visible'),
        outlineColor: style.outlineColor,
        outlineOffset: style.outlineOffset,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        pointerReturn: node.hasAttribute('data-lattice-pointer-focus-return'),
        selectionRanges: globalThis.getSelection()?.rangeCount || 0,
      };
    });
    assert.equal(returnedFocus.selectionRanges, 0, `viewer close leaves no native text range: ${JSON.stringify(returnedFocus)}`);
    assert.equal(returnedFocus.active, true, `pointer close returns logical focus to its placement: ${JSON.stringify(returnedFocus)}`);
    assert.equal(returnedFocus.pointerReturn, true, `pointer close marks its focus provenance: ${JSON.stringify(returnedFocus)}`);
    assert.equal(returnedFocus.outlineStyle, 'none', `pointer close must not paint a keyboard focus outline: ${JSON.stringify(returnedFocus)}`);

    await page.locator('.system-workflow__canvas').click({ position: { x: 1400, y: 100 } });
    const deselectedFocus = await mountain.evaluate((node) => ({
      active: document.activeElement === node,
      outlineStyle: getComputedStyle(node).outlineStyle,
      pointerReturn: node.hasAttribute('data-lattice-pointer-focus-return'),
      selected: node.getAttribute('aria-pressed'),
    }));
    assert.deepEqual(deselectedFocus, { active: true, outlineStyle: 'none', pointerReturn: true, selected: 'false' },
      'canvas deselection does not resurrect a native outline on the returned placement');

    await mountain.click();
    await page.locator('.system-workflow__canvas').click({ position: { x: 1400, y: 100 } });
    const ordinaryDeselection = await mountain.evaluate((node) => ({
      active: document.activeElement === node,
      outlineStyle: getComputedStyle(node).outlineStyle,
      pointerReturn: node.hasAttribute('data-lattice-pointer-focus-return'),
      selected: node.getAttribute('aria-pressed'),
    }));
    assert.deepEqual(ordinaryDeselection, { active: true, outlineStyle: 'none', pointerReturn: true, selected: 'false' },
      'ordinary pointer selection and deselection cannot resurrect the returned focus outline');

    await page.keyboard.press('Enter');
    await page.getByRole('dialog', { name: 'MOUNTAIN SIGNAL II focus viewer' }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: 'MOUNTAIN SIGNAL II focus viewer' }).waitFor({ state: 'detached' });
    const keyboardFocus = await mountain.evaluate((node) => ({
      active: document.activeElement === node,
      focusVisible: node.matches(':focus-visible'),
      outlineWidth: getComputedStyle(node).outlineWidth,
      pointerReturn: node.hasAttribute('data-lattice-pointer-focus-return'),
    }));
    assert.deepEqual(keyboardFocus, { active: true, focusVisible: true, outlineWidth: '1px', pointerReturn: false },
      'keyboard close preserves an accessible visible focus return');

    for (const width of [1439, 1920, 1921]) {
      await page.setViewportSize({ width, height: 900 });
      await mountain.dblclick();
      const handoff = await page.evaluate(async () => new Promise((resolveHandoff) => {
        const samples = [];
        const sample = () => {
          const viewer = document.querySelector('[data-lattice-focus-viewer]');
          const image = viewer?.querySelector('.lattice-production-focus-artwork__media');
          if (image) samples.push({ left: image.getBoundingClientRect().left, phase: viewer.dataset.phase });
          if (viewer?.dataset.phase === 'open') {
            resolveHandoff({
              opening: samples.findLast(({ phase }) => phase === 'opening'),
              stable: samples.find(({ phase }) => phase === 'open'),
            });
          } else requestAnimationFrame(sample);
        };
        sample();
      }));
      assert.ok(handoff.opening && handoff.stable, `viewer exposes an endpoint handoff at ${width}px`);
      assert.ok(Math.abs(handoff.opening.left - handoff.stable.left) < 0.01,
        `viewer media shifted after opening at ${width}px: ${JSON.stringify(handoff)}`);
      await page.getByRole('button', { name: 'Close artwork viewer' }).click();
      await page.getByRole('dialog', { name: 'MOUNTAIN SIGNAL II focus viewer' }).waitFor({ state: 'detached' });
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.getByRole('button', { name: 'Lock MOUNTAIN SIGNAL II', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Bring to front', exact: true }).isDisabled(), true);
    const beforeDrag = await inspector.boundingBox();
    const dragHandle = inspector.locator('.system-workflow__layers-header');
    const dragRect = await dragHandle.boundingBox();
    await page.mouse.move(dragRect.x + 80, dragRect.y + dragRect.height / 2);
    await page.mouse.down();
    await page.mouse.move(dragRect.x - 70, dragRect.y - 80, { steps: 4 });
    await page.mouse.up();
    const afterDrag = await inspector.boundingBox();
    assert.ok(afterDrag.x < beforeDrag.x - 100 && afterDrag.y < beforeDrag.y - 50, 'desktop Layers panel follows its drag handle');
    await inspector.getByRole('button', { name: 'Minimize Layers' }).click();
    await inspector.waitFor({ state: 'detached' });
    const layersTrigger = page.getByRole('button', { name: 'Layers', exact: true });
    assert.deepEqual(await layersTrigger.evaluate((node) => {
      const style = getComputedStyle(node);
      return [style.opacity, style.visibility, style.color === 'rgba(0, 0, 0, 0)'];
    }), ['1', 'visible', false], 'minimized Layers keeps an opaque, visible themed icon');
    await layersTrigger.click();
    await inspector.waitFor();
    const restoredPosition = await inspector.boundingBox();
    assert.equal(Math.round(restoredPosition.x), Math.round(afterDrag.x), 'Layers position survives minimize and restore');
    assert.equal(Math.round(restoredPosition.y), Math.round(afterDrag.y), 'Layers position survives minimize and restore');
    await page.getByRole('button', { name: /^Grids$/i }).click();
    await page.locator('.system-workflow__grid-switcher').waitFor();
    assert.equal(await page.locator('.system-workflow__inspector').count(), 0, 'Grid switcher owns the overlay layer exclusively');

    await page.goto(`${ROOT}/owner-shell-system-prototype.html`, { waitUntil: 'networkidle' });
    await page.locator('.owner-shell-system__placement').first().click();
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'prototype-inspector-1440x900.png') });
  } finally {
    await browser.close();
  }
});
