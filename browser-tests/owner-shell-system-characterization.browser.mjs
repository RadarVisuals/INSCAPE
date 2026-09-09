import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createServer as createViteServer } from 'vite';
import {
  BROWSER_LIFECYCLE_TIMEOUTS,
  createBrowserTestCleanup,
  createLifecycleDiagnostics,
  withinDeadline,
} from './browser-test-lifecycle.mjs';
import {
  createPlaywrightRouteController,
  launchPlaywrightEdge,
  settlePlaywrightAnimationFrames,
} from './playwright-browser-adapter.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeDir = resolve(root,
  `.browser-test-runtime-system-characterization-${process.pid}-${Date.now()}-${randomUUID()}`);
const prototypePath = '/owner-shell-system-prototype.html';
const edgeArguments = Object.freeze([
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-component-update',
  '--disable-background-networking',
  '--disk-cache-size=1',
  '--media-cache-size=1',
]);

async function availablePort() {
  const socket = createServer();
  return withinDeadline(new Promise((resolvePort, reject) => {
    socket.unref();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const { port } = socket.address();
      socket.close(() => resolvePort(port));
    });
  }), BROWSER_LIFECYCLE_TIMEOUTS.commandMs,
  'Timed out acquiring an owner-shell system characterization port', () => socket.close());
}

async function findBrowser() {
  const candidates = [
    process.env.BROWSER_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue through the bounded local browser inventory.
    }
  }
  throw new Error('No Edge/Chromium browser found for the system prototype characterization');
}

const elapsed = (started) => Number(process.hrtime.bigint() - started) / 1_000_000;

async function waitForPanel(page, selector, phase = 'open') {
  await page.locator(selector).waitFor({ state: 'attached' });
  await page.waitForFunction(({ expected, target }) =>
    document.querySelector(target)?.getAttribute('data-panel-phase') === expected,
  { expected: phase, target: selector });
  if (phase === 'open') await page.waitForFunction((target) => {
    const node = document.querySelector(target);
    if (!node) return false;
    const style = getComputedStyle(node);
    return style.opacity === '1' && (style.transform === 'none' || style.transform === 'matrix(1, 0, 0, 1, 0, 0)');
  }, selector);
}

async function closePanelWithEscape(page, selector, expectedFocus) {
  const started = process.hrtime.bigint();
  await page.keyboard.press('Escape');
  await page.locator(selector).waitFor({ state: 'detached' });
  if (expectedFocus) {
    assert.equal(await expectedFocus.evaluate((node) => document.activeElement === node), true,
      'Escape preserves the exact dock trigger focus');
  }
  return elapsed(started);
}

async function rectangle(locator) {
  const box = await locator.boundingBox();
  assert.ok(box && box.width > 0 && box.height > 0, 'expected a measurable visible rectangle');
  return box;
}

const overlaps = (left, right) => !(
  left.x + left.width <= right.x || right.x + right.width <= left.x
  || left.y + left.height <= right.y || right.y + right.height <= left.y
);

async function captureShellGeometry(page, { requirePlacementContained = true } = {}) {
  const viewport = page.viewportSize();
  const dock = await rectangle(page.locator('.owner-shell-system__global'));
  const canvas = await rectangle(page.getByRole('region', { name: 'Central lattice' }));
  const firstPlacement = await rectangle(page.getByRole('button', { name: 'Select Abyssal Study' }));
  assert.ok(Math.abs(dock.x) < 1 && Math.abs(dock.width - viewport.width) < 1,
    'the fixed dock spans the viewport');
  assert.ok(Math.abs(dock.y + dock.height - viewport.height) < 1,
    'the fixed dock remains attached to the bottom edge');
  assert.ok(Math.abs(canvas.x) < 1 && Math.abs(canvas.y) < 1,
    'the lattice begins at the viewport origin');
  assert.ok(Math.abs(canvas.height + dock.height - viewport.height) < 1,
    'the lattice ends exactly above the dock');
  const placementContained = firstPlacement.x >= canvas.x && firstPlacement.y >= canvas.y
    && firstPlacement.x + firstPlacement.width <= canvas.x + canvas.width
    && firstPlacement.y + firstPlacement.height <= canvas.y + canvas.height;
  if (requirePlacementContained) {
    assert.equal(placementContained, true, 'the authored placement stays inside the desktop lattice');
  }
  return { canvas, dock, firstPlacement, placementContained, viewport };
}

async function runWideCharacterization(page, baseUrl, ledger) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`${baseUrl}${prototypePath}`, { waitUntil: 'domcontentloaded' });
  await page.locator('.owner-shell-system').waitFor({ state: 'visible' });
  const documentId = await page.evaluate(() => window.__ownerShellSystemCharacterizationDocumentId);
  const initialStorage = await page.evaluate(() => ({
    local: Object.keys(localStorage).sort(),
    session: Object.keys(sessionStorage).sort(),
  }));
  assert.deepEqual(initialStorage, { local: [], session: [] }, 'the isolated prototype starts without persistence');
  ledger.push({ event: 'wide-shell-ready', geometry: await captureShellGeometry(page) });

  const libraryTrigger = page.getByRole('button', { name: 'LIBRARY', exact: true });
  const libraryStarted = process.hrtime.bigint();
  await libraryTrigger.click();
  await waitForPanel(page, '.owner-shell-system__library');
  ledger.push({ event: 'library-open', elapsedMs: elapsed(libraryStarted) });
  assert.equal(await page.locator('.owner-shell-system').getAttribute('data-canvas-context'), 'workspace');
  ledger.push({ event: 'library-escape-close', elapsedMs: await closePanelWithEscape(
    page, '.owner-shell-system__library', libraryTrigger,
  ) });
  await libraryTrigger.click();
  await waitForPanel(page, '.owner-shell-system__library');

  const settingsTrigger = page.getByRole('button', { name: 'SETTINGS', exact: true });
  await settingsTrigger.click();
  await waitForPanel(page, '.owner-shell-system__settings');
  await page.locator('.owner-shell-system__library').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.owner-shell-system__settings').getAttribute('aria-label'), 'Settings');
  ledger.push({ event: 'exclusive-panel-switch', target: 'settings' });
  const surfaceSelectTrigger = page.locator('.owner-shell-system__settings-theme .owner-shell-system__rail-select').first();
  await surfaceSelectTrigger.click();
  const surfaceSelect = page.getByRole('listbox');
  await surfaceSelect.waitFor({ state: 'visible' });
  assert.ok(await surfaceSelect.getByRole('option').count() > 1, 'the shared surface selector exposes its options');
  await page.keyboard.press('Escape');
  await surfaceSelect.waitFor({ state: 'detached' });
  assert.equal(await surfaceSelectTrigger.evaluate((node) => document.activeElement === node), true,
    'Escape returns focus to the exact shared select trigger');
  ledger.push({ event: 'shared-select-focus-round-trip' });
  const gridDisplayTrigger = page.locator('.owner-shell-system__settings-theme label').filter({ hasText: 'GRID DISPLAY' })
    .getByRole('button');
  await gridDisplayTrigger.click();
  await page.getByRole('option', { name: 'DOTS', exact: true }).click();
  assert.equal(await page.locator('.owner-shell-system__canvas').getAttribute('data-grid-display'), 'dots');
  const dotSize = page.getByRole('slider', { name: 'Dot size' });
  await dotSize.fill('3');
  assert.equal(await page.locator('.owner-shell-system__canvas').evaluate((node) => node.style.getPropertyValue('--prototype-grid-dot-size')), '3px');
  await gridDisplayTrigger.click();
  await page.getByRole('option', { name: 'NONE', exact: true }).click();
  assert.equal(await page.locator('.owner-shell-system__canvas').getAttribute('data-grid-display'), 'none');
  await gridDisplayTrigger.click();
  await page.getByRole('option', { name: 'LINES', exact: true }).click();
  assert.equal(await page.locator('.owner-shell-system__canvas').getAttribute('data-grid-display'), 'lines');
  ledger.push({ event: 'grid-display-round-trip' });
  await settingsTrigger.focus();
  ledger.push({ event: 'settings-close', elapsedMs: await closePanelWithEscape(
    page, '.owner-shell-system__settings', settingsTrigger,
  ) });

  const discoverTrigger = page.getByRole('button', { name: 'DISCOVER', exact: true });
  await discoverTrigger.click();
  await waitForPanel(page, '.owner-shell-system__discover');
  assert.equal(await page.locator('.owner-shell-system__discover-grid > button').count(), 3);
  const discoverRailItems = page.locator('.owner-shell-system__discover .owner-shell-system__workspace-rail-controls > *');
  const railGeometryBeforeFilter = await discoverRailItems.evaluateAll((nodes) => nodes.slice(0, 5).map((node) => {
    const rectangle = node.getBoundingClientRect();
    return { left: rectangle.left, width: rectangle.width };
  }));
  const discoverFilter = page.locator('.owner-shell-system__discover button[aria-haspopup="dialog"]');
  assert.equal(await discoverFilter.getAttribute('aria-label'), 'Filters');
  await discoverFilter.click();
  const filterPopover = page.getByRole('dialog', { name: 'Filters' });
  const filterPresentation = await filterPopover.evaluate((node) => {
    const style = getComputedStyle(node);
    const rectangle = node.getBoundingClientRect();
    return { backgroundColor: style.backgroundColor, color: style.color, height: rectangle.height, width: rectangle.width };
  });
  assert.equal(filterPresentation.color, 'rgb(17, 19, 19)');
  assert.equal(filterPresentation.backgroundColor, 'rgb(215, 211, 202)');
  assert.ok(filterPresentation.height < 260 && filterPresentation.width <= 252,
    'the filter facet uses the compact anchored-menu geometry');
  await page.getByRole('radio', { name: 'ARTIST', exact: true }).click();
  assert.equal((await discoverFilter.textContent()).trim(), 'FILTERS');
  assert.equal(await discoverFilter.getAttribute('data-active'), 'true');
  assert.equal(await page.locator('.owner-shell-system__discover-grid > button').count(), 1);
  const railGeometryAfterFilter = await discoverRailItems.evaluateAll((nodes) => nodes.slice(0, 5).map((node) => {
    const rectangle = node.getBoundingClientRect();
    return { left: rectangle.left, width: rectangle.width };
  }));
  assert.deepEqual(railGeometryAfterFilter, railGeometryBeforeFilter,
    'activating a filter does not shift the shared workspace rail');
  const discoverQuery = page.locator('.owner-shell-system__discover').getByRole('searchbox', { name: 'Search' });
  await discoverQuery.fill('surface');
  await page.getByRole('button', { name: 'RESET', exact: true }).click();
  assert.equal((await discoverFilter.textContent()).trim(), 'FILTERS');
  assert.equal(await discoverFilter.getAttribute('data-active'), null);
  assert.equal(await discoverQuery.inputValue(), 'surface', 'resetting facets preserves the independent search query');
  await discoverQuery.fill('');
  await discoverFilter.click();
  await filterPopover.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'FOLLOWING', exact: true }).click();
  assert.equal(await page.locator('.owner-shell-system__discover-grid > button').count(), 2);
  const discoverSearch = discoverQuery;
  await discoverSearch.fill('signal');
  assert.equal(await page.locator('.owner-shell-system__discover-grid > button').count(), 1);
  await discoverSearch.fill('');
  const discoverSize = page.locator('.owner-shell-system__discover').getByRole('slider', { name: 'Card size' });
  await discoverSize.fill('260');
  assert.equal(await page.locator('.owner-shell-system__discover-browser').evaluate((node) =>
    node.style.getPropertyValue('--discover-card-size')), '260px');
  const discoverCloseStarted = process.hrtime.bigint();
  await page.locator('.owner-shell-system__discover').getByRole('button', { name: 'Close workspace' }).click();
  await page.locator('.owner-shell-system__discover').waitFor({ state: 'detached' });
  assert.equal(await discoverTrigger.evaluate((node) => document.activeElement === node), true,
    'the permanent workspace close control restores focus to Discover');
  ledger.push({ event: 'discover-round-trip', elapsedMs: elapsed(discoverCloseStarted) });

  const activityTrigger = page.getByRole('button', { name: /ACTIVITY/u });
  assert.equal(await activityTrigger.locator('[aria-label="2 unread"]').count(), 1);
  await activityTrigger.click();
  await waitForPanel(page, '.owner-shell-system__activity-drawer');
  await page.getByRole('button', { name: 'Open full activity history' }).click();
  const activityHistory = page.getByRole('region', { name: 'Full activity history' });
  await activityHistory.waitFor({ state: 'visible' });
  await activityHistory.getByRole('button', { name: 'Mark all activity read' }).click();
  await activityTrigger.locator('[aria-label$=" unread"]').waitFor({ state: 'detached' });
  assert.equal(await activityHistory.locator('li[data-unread]').count(), 0,
    'marking all activity read clears every unread state and the global badge');
  await page.keyboard.press('Escape');
  await activityHistory.waitFor({ state: 'detached' });
  ledger.push({ event: 'activity-read-state-round-trip' });

  const profileTrigger = page.getByRole('button', { name: 'PROFILE', exact: true });
  await profileTrigger.click();
  await waitForPanel(page, '.owner-shell-system__profile');
  const profileCard = page.locator('[data-identity-dossier-source="true"]');
  const identity = page.getByRole('dialog', { name: 'RADAR VISUALS identity rack' });
  const openIdentity = async () => {
    await profileCard.click();
    await identity.waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('.owner-shell-system-identity')?.dataset.phase === 'open');
  };
  const expectIdentityMinimized = async (reason) => {
    await identity.waitFor({ state: 'detached' });
    await page.locator('.owner-shell-system__profile').waitFor({ state: 'visible' });
    assert.equal(await profileTrigger.getAttribute('aria-expanded'), 'true', `${reason} keeps the compact Profile panel open`);
    assert.equal(await profileCard.evaluate((node) => document.activeElement === node), true,
      `${reason} returns focus to the compact profile card`);
  };

  await openIdentity();
  assert.equal(await profileCard.getAttribute('data-viewing'), 'true');
  assert.ok((await rectangle(identity.locator('.owner-shell-system-identity__rack'))).height <= 620,
    'the expanded profile dossier retains its bounded desktop height');
  await identity.getByRole('button', { name: 'LINK MODULE' }).click();
  assert.equal(await identity.getByRole('button', { name: 'LINK MODULE' }).getAttribute('aria-expanded'), 'true');
  await profileTrigger.click();
  await expectIdentityMinimized('Profile toggle');

  await openIdentity();
  await page.locator('.owner-shell-system__canvas').click({ position: { x: 40, y: 40 } });
  await expectIdentityMinimized('Outside click');

  await openIdentity();
  await page.keyboard.press('Escape');
  await expectIdentityMinimized('Escape');

  await openIdentity();
  await identity.getByRole('button', { name: 'Close profile' }).click();
  await expectIdentityMinimized('Explicit close');
  await page.keyboard.press('Escape');
  await page.locator('.owner-shell-system__profile').waitFor({ state: 'detached' });
  ledger.push({ event: 'identity-round-trip' });

  const placement = page.locator('.owner-shell-system__placement[aria-label="Select Abyssal Study"]');
  await placement.click();
  assert.equal(await placement.getAttribute('aria-pressed'), 'true');
  const inspector = page.getByRole('complementary', { name: 'Selection and layers inspector' });
  await inspector.waitFor({ state: 'visible' });
  assert.equal(overlaps(await rectangle(placement), await rectangle(inspector)), false,
    'the adaptive inspector does not cover the selected placement');
  await placement.dblclick();
  const viewer = page.getByRole('dialog', { name: 'Abyssal Study focus viewer' });
  await viewer.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('[data-lattice-focus-viewer]')?.dataset.phase === 'open');
  assert.equal(await placement.getAttribute('data-viewing'), 'true');
  assert.equal(await viewer.getByRole('navigation', { name: 'Artwork viewer navigation' }).getByText('01 / 02').count(), 1);
  const openNavigation = await rectangle(viewer.getByRole('navigation', { name: 'Artwork viewer navigation' }));
  assert.ok(Math.abs(openNavigation.x + (openNavigation.width / 2) - (page.viewportSize().width / 2)) < 1,
    'artwork navigation remains centered in the viewport while inspection is open');
  await viewer.locator('.lattice-focus-viewer__artwork').click();
  assert.equal(await viewer.locator('.lattice-focus-viewer__rack').getAttribute('aria-hidden'), 'true');
  await page.waitForFunction(() => {
    const artwork = document.querySelector('.lattice-focus-viewer__artwork');
    if (!artwork) return false;
    const bounds = artwork.getBoundingClientRect();
    return Math.abs(bounds.left + (bounds.width / 2) - (window.innerWidth / 2)) < 1;
  });
  const centeredArtwork = await rectangle(viewer.locator('.lattice-focus-viewer__artwork'));
  const anchoredNavigation = await rectangle(viewer.getByRole('navigation', { name: 'Artwork viewer navigation' }));
  assert.ok(Math.abs(
    centeredArtwork.x + (centeredArtwork.width / 2)
      - (anchoredNavigation.x + (anchoredNavigation.width / 2)),
  ) < 1, 'artwork navigation remains anchored to the centered artwork stage');
  await page.keyboard.press('Escape');
  await viewer.waitFor({ state: 'detached' });
  assert.equal(await placement.evaluate((node) => document.activeElement === node), true,
    'artwork viewer returns focus to the exact placement');
  ledger.push({ event: 'artwork-viewer-round-trip' });

  await inspector.getByRole('button', { name: 'Rotate', exact: true }).click();
  await page.getByText('ROTATE CONTROL PLACED HERE / NOT CONNECTED', { exact: true }).waitFor({ state: 'visible' });

  await inspector.getByRole('button', { name: 'Crop', exact: true }).click();
  const cropControls = page.getByRole('region', { name: 'Crop controls' });
  await cropControls.waitFor({ state: 'visible' });
  await cropControls.getByRole('slider', { name: 'Crop zoom' }).fill('1.5');
  assert.equal(await cropControls.getByRole('status').textContent(), '150%');
  await page.locator('.owner-shell-system__canvas').click({ position: { x: 40, y: 40 } });
  await cropControls.waitFor({ state: 'visible' });
  await page.keyboard.press('Enter');
  await inspector.getByRole('navigation', { name: 'Selection actions' }).waitFor({ state: 'visible' });
  assert.equal(await placement.getAttribute('data-cropped'), 'true');

  const cropResizeStart = await rectangle(placement);
  await inspector.getByRole('button', { name: 'Crop', exact: true }).click();
  const cropResizeHandle = page.getByRole('button', { name: 'Resize selection from se' });
  const cropResizeHandleBounds = await rectangle(cropResizeHandle);
  await page.mouse.move(cropResizeHandleBounds.x + 4, cropResizeHandleBounds.y + 4);
  await page.mouse.down();
  await page.mouse.move(cropResizeHandleBounds.x + 84, cropResizeHandleBounds.y + 84, { steps: 4 });
  await page.mouse.up();
  const cropResizeApplied = await rectangle(placement);
  assert.ok(cropResizeApplied.width > cropResizeStart.width && cropResizeApplied.height > cropResizeStart.height,
    'crop mode permits resizing the crop frame');
  await cropControls.getByRole('button', { name: 'DONE', exact: true }).click();
  await inspector.getByRole('navigation', { name: 'Selection actions' }).waitFor({ state: 'visible' });

  await inspector.getByRole('button', { name: 'Crop', exact: true }).click();
  await cropControls.getByRole('slider', { name: 'Crop zoom' }).fill('2');
  await page.keyboard.press('Escape');
  await inspector.getByRole('navigation', { name: 'Selection actions' }).waitFor({ state: 'visible' });
  assert.equal(await placement.getAttribute('data-cropped'), 'true', 'Escape preserves the previously committed crop');
  assert.deepEqual(await rectangle(placement), cropResizeApplied, 'Escape preserves the previously committed crop frame');

  await inspector.getByRole('button', { name: 'Crop', exact: true }).click();
  await cropControls.getByRole('slider', { name: 'Crop zoom' }).fill('1.75');
  await libraryTrigger.click();
  await waitForPanel(page, '.owner-shell-system__library');
  assert.equal(await placement.getAttribute('data-cropped'), 'true', 'switching panels commits an interacted crop');
  await page.keyboard.press('Escape');
  await page.locator('.owner-shell-system__library').waitFor({ state: 'detached' });
  await inspector.waitFor({ state: 'visible' });

  await inspector.getByRole('button', { name: 'Crop', exact: true }).click();
  await cropControls.getByRole('button', { name: 'NATIVE FIT', exact: true }).click();
  await inspector.getByRole('navigation', { name: 'Selection actions' }).waitFor({ state: 'visible' });
  assert.equal(await placement.getAttribute('data-cropped'), null);

  await inspector.getByRole('button', { name: 'Frame and mat', exact: true }).click();
  const presentationControls = page.getByRole('region', { name: 'Frame and mat controls' });
  await presentationControls.waitFor({ state: 'visible' });
  const presentationSelects = presentationControls.locator('select');
  assert.equal(await presentationSelects.count(), 3, 'frame, mat and transparency remain distinct controls');
  assert.deepEqual(await presentationControls.locator('label > span').allTextContents(), [
    'FRAME', 'MAT', 'MAT COLOR', 'BACKING', 'BACKING COLOR', 'TRANSPARENCY',
  ]);
  await presentationSelects.nth(0).selectOption('DOSSIER');
  await presentationSelects.nth(1).selectOption('CAPTION');
  await presentationControls.locator('input[type="checkbox"]').check();
  await presentationSelects.nth(2).selectOption('OPAQUE');
  await presentationControls.getByRole('button', { name: 'APPLY', exact: true }).click();
  await page.getByText('FRAME & MAT CONTROLS / NOT CONNECTED', { exact: true }).waitFor({ state: 'visible' });
  await inspector.getByRole('navigation', { name: 'Selection actions' }).waitFor({ state: 'visible' });

  const placementCount = await page.locator('.owner-shell-system__placement').count();
  await inspector.getByRole('button', { name: 'Remove Abyssal Study from table' }).click();
  await inspector.getByText('REMOVE FROM TABLE?', { exact: true }).waitFor({ state: 'visible' });
  await inspector.getByRole('button', { name: 'CANCEL', exact: true }).click();
  assert.equal(await page.locator('.owner-shell-system__placement').count(), placementCount,
    'cancelling layer removal preserves every placement');
  ledger.push({ event: 'selection-inspector-round-trip' });

  const beforeResize = await rectangle(placement);
  const southeastHandle = page.getByRole('button', { name: 'Resize selection from se' });
  const handleRectangle = await rectangle(southeastHandle);
  await page.mouse.move(handleRectangle.x + handleRectangle.width / 2, handleRectangle.y + handleRectangle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleRectangle.x + handleRectangle.width / 2 + 40, handleRectangle.y + handleRectangle.height / 2 + 40, { steps: 4 });
  await page.mouse.up();
  const afterResize = await rectangle(placement);
  assert.ok(Math.abs(afterResize.x - beforeResize.x) <= 20,
    'southeast resize normalizes the off-grid fixture by at most half a grid cell horizontally');
  assert.ok(Math.abs(afterResize.y - beforeResize.y) <= 20,
    'southeast resize normalizes the off-grid fixture by at most half a grid cell vertically');
  assert.ok(afterResize.width > beforeResize.width && afterResize.height > beforeResize.height,
    'southeast resize grows the selected placement');
  ledger.push({ event: 'canvas-resize', before: beforeResize, after: afterResize });

  await inspector.getByRole('button', { name: 'Lock Abyssal Study' }).click();
  assert.equal(await placement.getAttribute('data-locked'), 'true');
  assert.equal(await placement.getAttribute('aria-disabled'), 'true');
  assert.equal(await placement.getAttribute('tabindex'), '-1');
  assert.equal(await placement.getAttribute('aria-pressed'), 'false',
    'locking removes the placement from the editable canvas selection');
  const lockedCenter = {
    x: afterResize.x + afterResize.width / 2,
    y: afterResize.y + afterResize.height / 2,
  };
  await page.mouse.move(lockedCenter.x, lockedCenter.y);
  await page.mouse.down();
  await page.mouse.move(lockedCenter.x + 24, lockedCenter.y + 24, { steps: 3 });
  await page.mouse.up();
  assert.equal(await placement.getAttribute('aria-pressed'), 'false',
    'marquee selection passes through and ignores a locked placement');
  await inspector.waitFor({ state: 'visible' });
  await inspector.getByRole('button', { name: 'Unlock Abyssal Study' }).click();
  assert.equal(await placement.getAttribute('data-locked'), null);
  assert.equal(await placement.getAttribute('aria-disabled'), null);
  await placement.click();
  assert.equal(await placement.getAttribute('aria-pressed'), 'true',
    'unlocking restores ordinary canvas selection');
  ledger.push({ event: 'placement-lock-round-trip' });

  const tableTrigger = page.locator('.owner-shell-system__table');
  await tableTrigger.click();
  await waitForPanel(page, '.owner-shell-system__table-switcher');
  const tablePanel = await rectangle(page.locator('.owner-shell-system__table-switcher'));
  assert.ok(Math.abs((tablePanel.x + tablePanel.width / 2) - 720) < 1,
    'the table switcher stays centered on the viewport');
  await page.getByRole('button', { name: 'NEW TABLE' }).click();
  assert.match(await tableTrigger.textContent(), /TABLE 02/u);
  assert.equal(await page.locator('.owner-shell-system__placement').count(), 0,
    'a new active table begins empty');
  const tableRows = page.locator('.owner-shell-system__table-row');
  await page.getByRole('button', { name: 'Reorder TABLE 02' }).dragTo(tableRows.nth(0), {
    targetPosition: { x: 12, y: 2 },
  });
  assert.match(await tableRows.nth(0).textContent(), /TABLE 02/u,
    'dragging a grid before Home changes only its projected order');
  assert.match(await tableTrigger.textContent(), /TABLE 02/u,
    'the reordered active grid retains its identity');
  assert.equal(await page.locator('.owner-shell-system__placement').count(), 0,
    'reordering does not move Home placements into the active grid');
  const reorderedHandle = page.getByRole('button', { name: 'Reorder TABLE 02' });
  await reorderedHandle.focus();
  await reorderedHandle.press('Alt+ArrowDown');
  assert.match(await tableRows.nth(0).textContent(), /HOME/u,
    'Alt + ArrowDown provides the equivalent keyboard reorder operation');
  assert.equal(await reorderedHandle.evaluate((node) => document.activeElement === node), true,
    'keyboard reordering restores focus to the same stable grid handle');
  await libraryTrigger.click();
  await waitForPanel(page, '.owner-shell-system__library');
  await page.locator('.owner-shell-system__table-switcher').waitFor({ state: 'detached' });
  const libraryAsset = page.getByRole('button', { name: 'Abyssal Study / INSCAPE Studies' });
  const libraryAssetBounds = await rectangle(libraryAsset);
  const canvasBounds = await rectangle(page.getByRole('region', { name: 'Central lattice' }));
  await page.mouse.move(libraryAssetBounds.x + libraryAssetBounds.width / 2, libraryAssetBounds.y + libraryAssetBounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBounds.x + 360, canvasBounds.y + 280, { steps: 5 });
  await page.locator('.owner-shell-system__placement-preview').waitFor({ state: 'visible' });
  await page.mouse.up();
  assert.equal(await page.locator('.owner-shell-system__placement').count(), 1,
    'Library drag creates one placement on the currently active empty grid');
  assert.equal(await page.getByRole('button', { name: 'Select Abyssal Study' }).getAttribute('aria-pressed'), 'true',
    'the newly dropped placement becomes the exact active selection');
  await tableTrigger.click();
  await waitForPanel(page, '.owner-shell-system__table-switcher');
  await page.locator('.owner-shell-system__library').waitFor({ state: 'detached' });
  await page.getByRole('button', { name: /HOME PUBLIC/u }).click();
  assert.equal(await page.locator('.owner-shell-system__placement').count(), 2,
    'returning Home restores its exact placement set');
  await page.keyboard.press('Escape');
  await page.locator('.owner-shell-system__table-switcher').waitFor({ state: 'detached' });
  ledger.push({ event: 'table-switch-round-trip' });

  const previewTrigger = page.getByRole('button', { name: 'PREVIEW', exact: true });
  await previewTrigger.click();
  assert.equal(await page.locator('.owner-shell-system').getAttribute('data-preview'), 'true');
  await page.getByText('VISITOR PREVIEW / EDITING HIDDEN').waitFor({ state: 'visible' });
  assert.equal(await libraryTrigger.isDisabled(), true);
  await placement.click();
  await viewer.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('[data-lattice-focus-viewer]')?.dataset.phase === 'open');
  await page.keyboard.press('Escape');
  await viewer.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'RETURN', exact: true }).click();
  assert.equal(await page.locator('.owner-shell-system').getAttribute('data-preview'), null);
  ledger.push({ event: 'preview-round-trip' });

  assert.equal(await page.evaluate(() => window.__ownerShellSystemCharacterizationDocumentId), documentId,
    'the full wide journey keeps one document identity');
  assert.deepEqual(await page.evaluate(() => ({
    local: Object.keys(localStorage).sort(),
    session: Object.keys(sessionStorage).sort(),
  })), initialStorage, 'the full system study remains session-only');
}

async function runReducedCompactCharacterization(page, ledger) {
  await page.setViewportSize({ width: 720, height: 760 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.owner-shell-system').waitFor({ state: 'visible' });
  ledger.push({
    event: 'compact-shell-ready',
    geometry: await captureShellGeometry(page, { requirePlacementContained: false }),
  });
  const tableTrigger = page.locator('.owner-shell-system__table');
  assert.ok((await rectangle(tableTrigger)).width <= 53, 'the compact table launcher collapses to one icon cell');

  const libraryTrigger = page.getByRole('button', { name: 'LIBRARY', exact: true });
  await libraryTrigger.click();
  await waitForPanel(page, '.owner-shell-system__library');
  const closeStarted = process.hrtime.bigint();
  await libraryTrigger.click();
  await page.locator('.owner-shell-system__library').waitFor({ state: 'detached' });
  const closeMs = elapsed(closeStarted);
  assert.ok(closeMs < 1_000, 'reduced motion removes the lingering panel exit');

  const placement = page.locator('.owner-shell-system__placement[aria-label="Select Abyssal Study"]');
  await placement.focus();
  await placement.press('Enter');
  const viewer = page.getByRole('dialog', { name: 'Abyssal Study focus viewer' });
  await viewer.waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('[data-lattice-focus-viewer]')?.dataset.phase === 'open');
  await page.keyboard.press('Escape');
  await viewer.waitFor({ state: 'detached' });
  assert.equal(await placement.evaluate((node) => document.activeElement === node), true,
    'reduced-motion viewer keeps exact keyboard focus restoration');
  ledger.push({ event: 'compact-reduced-round-trip', panelCloseMs: closeMs });
}

test('unchanged owner-shell system prototype retains its executable interaction baseline',
  { timeout: 120_000 }, async (context) => {
    const resources = {};
    const problems = [];
    const navigations = [];
    const ledger = [];
    const diagnostic = createLifecycleDiagnostics((message) => context.diagnostic(message));
    let cleanup = createBrowserTestCleanup({ runtimePath: runtimeDir, workspaceRoot: root, diagnostic });
    try {
      const port = await availablePort();
      const baseUrl = `http://127.0.0.1:${port}`;
      resources.vite = await createViteServer({
        root,
        logLevel: 'error',
        server: { host: '127.0.0.1', port, strictPort: true },
      });
      await resources.vite.listen();
      const routeController = createPlaywrightRouteController({
        loopbackOrigin: baseUrl,
        knownOrigins: [],
        decideKnown: async () => ({ action: 'abort', errorCode: 'blockedbyclient' }),
        onUnexpected: (origin) => problems.push(`Unexpected origin: ${origin}`),
      });
      const launched = await launchPlaywrightEdge({
        edgePath: await findBrowser(),
        runtimePath: runtimeDir,
        workspaceRoot: root,
        loopbackOrigin: baseUrl,
        routeController,
        resources,
        browserArgs: edgeArguments,
        contextOptions: { viewport: { width: 1440, height: 900 } },
        diagnostic,
        onBrowserProblem: (problem) => problems.push(problem),
        onOwnedProcess: ({ rootPid, processTree }) => {
          cleanup = createBrowserTestCleanup({
            rootPid, processTree, runtimePath: runtimeDir, workspaceRoot: root, diagnostic,
          });
        },
      });
      const page = launched.page;
      page.setDefaultTimeout(10_000);
      page.setDefaultNavigationTimeout(10_000);
      await page.addInitScript(() => {
        window.__ownerShellSystemCharacterizationDocumentId = crypto.randomUUID();
      });
      page.on('framenavigated', (frame) => {
        if (frame === page.mainFrame()) navigations.push(frame.url());
      });

      await runWideCharacterization(page, baseUrl, ledger);
      assert.equal(navigations.length, 1, 'the wide journey performs only its initial navigation');
      await runReducedCompactCharacterization(page, ledger);
      assert.equal(navigations.length, 2, 'only the intentional compact baseline reload adds a navigation');
      assert.deepEqual(problems, [], `browser problems: ${problems.join(' | ')}`);
      context.diagnostic(`Owner-shell system baseline ${JSON.stringify(ledger)}`);
    } finally {
      const result = await cleanup(resources);
      context.diagnostic(`Owner-shell system cleanup ${JSON.stringify(result)}`);
    }
  });
