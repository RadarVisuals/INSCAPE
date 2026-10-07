import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright-core';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
const SCREENSHOT_DIR = process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR ? resolve(process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR) : null;

test('Library workspace exposes accepted views, stable filters and one-commit placement', { timeout: 90_000 }, async () => {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  try {
    if (SCREENSHOT_DIR) await mkdir(SCREENSHOT_DIR, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${ROOT}/development/owner/system-workflow`, { waitUntil: 'networkidle' });
    await page.evaluate(() => { window.__workflowWrites = 0; addEventListener('inscape:review-storage-write', event => { if (event.detail.key.startsWith('inscape.system-workflow-draft.')) window.__workflowWrites += 1; }); });
    const compositionBefore = await page.locator('.system-workflow__presentation-board').boundingBox();
    const trigger = page.getByRole('button', { name: 'Library', exact: true });
    await trigger.click();
    const workspace = page.getByRole('region', { name: 'Library workspace' });
    await workspace.waitFor();
    await page.waitForFunction(() => document.querySelector('[aria-label="Library workspace"]')?.closest('[data-system-workflow-panel]')?.dataset.panelPhase === 'open');
    await page.waitForFunction(() => document.querySelectorAll('.system-workflow__library .lattice-browser-asset').length === 7);
    const bounds = await workspace.boundingBox();
    assert.equal(bounds.x, 0, 'Library is anchored to the left Workbench edge');
    assert.ok(bounds.y >= 0 && bounds.width > 0 && bounds.width < 1440 && bounds.y + bounds.height <= 900,
      'Library is a bounded overlay with Workbench space remaining visible');
    assert.deepEqual(await page.locator('.system-workflow__presentation-board').boundingBox(), compositionBefore,
      'opening Library does not reflow the composition');
    const sidebarResize = workspace.getByRole('button', { name: 'Resize Browser navigation' });
    assert.equal(await sidebarResize.evaluate((node) => getComputedStyle(node, '::after').width), '1px');
    assert.equal(await sidebarResize.evaluate((node) => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)');
    assert.equal(await workspace.locator('.lattice-browser-sidebar').evaluate((node) => getComputedStyle(node).borderRightWidth), '0px');
    assert.deepEqual(await workspace.locator('.lattice-browser-results').evaluate((node) => {
      const style = getComputedStyle(node); return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft];
    }), ['10px', '10px', '10px', '10px']);
    assert.equal(await workspace.getByRole('button', { name: 'All Assets', exact: true }).evaluate((node) => {
      const active = node.getBoundingClientRect(); const sidebar = node.parentElement.getBoundingClientRect();
      return Math.abs(active.right - sidebar.right) < 1;
    }), true, 'Library selection reaches the sidebar divider');
    const libraryCreate = workspace.getByRole('button', { name: 'Create Category', exact: true });
    const libraryCreateColor = await libraryCreate.evaluate((node) => getComputedStyle(node).backgroundColor);
    assert.equal((await libraryCreate.textContent()).trim(), 'Category');
    assert.equal(libraryCreateColor, 'rgba(0, 0, 0, 0)', 'Library Create action uses the clean shared sidebar surface');
    assert.deepEqual(await workspace.getByRole('button', { name: 'All Assets', exact: true }).evaluate((node) => {
      const style = getComputedStyle(node); const marker = getComputedStyle(node, '::before');
      return [style.boxShadow, marker.left, marker.width];
    }), ['none', '0px', '4px'], 'Library selection uses the shared four-pixel vertical marker');
    assert.equal(await workspace.getByRole('button', { name: 'All Assets', exact: true }).evaluate((node) => {
      const active = node.getBoundingClientRect();
      const browser = node.closest('.system-workflow__browser-workspace').getBoundingClientRect();
      return Math.abs(active.left - browser.left) < 0.01;
    }), true, 'Library selection occupies the Browser outer edge without a one-pixel gap');
    assert.deepEqual(await libraryCreate.evaluate((node) => {
      const heading = node.parentElement; return [getComputedStyle(heading).borderBottomWidth, getComputedStyle(node).borderBottomWidth];
    }), ['0px', '1px'], 'Library Create action uses one canonical lower border');
    const resizeBox = await sidebarResize.boundingBox();
    await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + 40);
    await page.mouse.down(); await page.mouse.move(resizeBox.x - 180, resizeBox.y + 40); await page.mouse.up();
    assert.equal(await workspace.getAttribute('data-sidebar-collapsed'), 'true');
    assert.equal(await workspace.getByRole('button', { name: 'All Assets', exact: true }).locator('b').evaluate((node) => getComputedStyle(node).display), 'none');
    const collapsedAllAssets = workspace.getByRole('button', { name: 'All Assets', exact: true });
    await collapsedAllAssets.hover();
    const libraryHoverLabel = workspace.locator('.system-workflow__sidebar-hover-label');
    await libraryHoverLabel.waitFor();
    assert.equal(await libraryHoverLabel.textContent(), 'All Assets');
    assert.equal(await libraryHoverLabel.getAttribute('data-active'), 'true');
    assert.equal(await libraryHoverLabel.evaluate((node) => getComputedStyle(node).borderLeftWidth), '0px');
    const libraryHoverGeometry = await libraryHoverLabel.evaluate((node) => {
      const label = node.getBoundingClientRect();
      const source = document.querySelector('[aria-label="All Assets"]').getBoundingClientRect();
      return { label: { height: label.height, left: label.left, top: label.top }, seam: Math.abs(label.left - source.right) < 1 && Math.abs(label.top - source.top) < 1 && Math.abs(label.height - source.height) < 1, source: { height: source.height, right: source.right, top: source.top } };
    });
    assert.equal(libraryHoverGeometry.seam, true, `collapsed Library hover label continues the source row without a gap: ${JSON.stringify(libraryHoverGeometry)}`);
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'review-library-collapsed-hover-1440x900.png') });
    const collapsedResizeBox = await sidebarResize.boundingBox();
    await page.mouse.move(collapsedResizeBox.x + collapsedResizeBox.width / 2, collapsedResizeBox.y + 40);
    await page.mouse.down(); await page.mouse.move(collapsedResizeBox.x + 126, collapsedResizeBox.y + 40); await page.mouse.up();
    assert.equal(await workspace.getAttribute('data-sidebar-collapsed'), null);
    for (const name of ['All Assets', 'Owned', 'Created', 'Unsorted', 'PORTFOLIO', 'FIELD NOTES']) assert.equal(await workspace.getByRole('button', { name, exact: true }).count(), 1);
    const rail = workspace.locator('.system-workflow__local-rail'); const railBefore = await rail.boundingBox();
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'review-library-1440x900.png') });

    await libraryCreate.click();
    const categoryDialog = workspace.locator('form[aria-label="Create category"]');
    assert.equal(await categoryDialog.count(), 1, 'category creation uses the compact inline sidebar editor');
    assert.equal(await categoryDialog.evaluate((node) => Boolean(node.closest('.system-workflow__library-create-row'))), true,
      'category editor remains anchored in the Library organization rail');
    await categoryDialog.locator('input').fill('Travel signals');
    await categoryDialog.locator('input').press('Enter');
    assert.equal(await workspace.getByRole('button', { name: 'Travel signals', exact: true }).count(), 1);
    await workspace.getByRole('button', { name: 'Travel signals', exact: true }).click();
    assert.deepEqual(await workspace.getByRole('button', { name: 'Travel signals', exact: true }).evaluate((node) => {
      const marker = getComputedStyle(node.parentElement, '::before'); return [marker.left, marker.width, marker.backgroundColor];
    }), ['0px', '4px', 'rgb(17, 19, 19)'], 'created Library categories use the shared four-pixel selection marker');
    await workspace.getByRole('button', { name: 'Travel signals', exact: true }).click({ button: 'right' });
    const categoryMenu = page.getByRole('menu', { name: 'Category commands' });
    assert.deepEqual(await categoryMenu.getByRole('menuitem').allTextContents(), ['Rename', 'Move / Outside sections', 'Delete'], 'Library category context exposes the canonical section move without obsolete publication visibility');
    assert.equal(await categoryMenu.getAttribute('data-menu-surface'), 'mist', 'Library context menu inherits the active workflow theme');
    await categoryMenu.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    const deleteCategoryDialog = workspace.getByRole('alertdialog', { name: 'Delete category Travel signals' });
    assert.match(await deleteCategoryDialog.textContent(), /Travel signals/);
    await deleteCategoryDialog.getByRole('button', { name: 'Cancel deleting Travel signals', exact: true }).click();
    await workspace.getByRole('button', { name: 'All Assets', exact: true }).click();

    await workspace.getByLabel('Search').fill('ZEBRA');
    assert.equal(await workspace.locator('.lattice-browser-asset').count(), 1);
    assert.match(await workspace.locator('.lattice-browser-asset__record strong').textContent(), /ZEBRA FIELD/);
    await workspace.getByLabel('Search').fill('');
    await workspace.getByLabel('Card size').fill('220');
    assert.equal(await workspace.locator('.lattice-browser-assets').evaluate((node) => getComputedStyle(node).getPropertyValue('--lattice-browser-asset-min').trim()), '220px');
    await workspace.locator('.system-workflow__workspace-labels input').uncheck();
    assert.equal(await workspace.locator('.lattice-browser-asset__record').count(), 0);
    await workspace.locator('.system-workflow__workspace-labels input').check();

    await workspace.getByRole('button', { name: /Filters: All/i }).click();
    const filterPopover = page.getByRole('dialog', { name: 'Filters' });
    assert.deepEqual(await filterPopover.evaluate((node) => {
      const bounds = node.getBoundingClientRect();
      const workspaceBounds = document.querySelector('[aria-label="Library workspace"]').getBoundingClientRect();
      const options = node.querySelector('.system-workflow__filter-options');
      return [bounds.top >= workspaceBounds.top + 17, bounds.bottom < innerHeight, getComputedStyle(options).overflowY];
    }), [true, true, 'auto'], 'collection filters remain viewport-bounded with an independently scrollable list');
    await page.getByRole('radio', { name: 'CHROMATIC FIELDS', exact: true }).click();
    assert.equal(await workspace.locator('.lattice-browser-asset').count(), 1);
    assert.match(await workspace.getByRole('button', { name: /Filters:/i }).getAttribute('aria-label'), /CHROMATIC FIELDS/i);
    await page.getByRole('radio', { name: 'All', exact: true }).click();
    await workspace.getByRole('button', { name: /Sort assets:/i }).click();
    await page.getByRole('option', { name: 'Z–A', exact: true }).click();
    assert.match(await workspace.locator('.lattice-browser-asset__record strong').first().textContent(), /ZEBRA FIELD/);
    assert.deepEqual(await rail.boundingBox(), railBefore, 'the bottom rail does not jump while values change');

    await page.evaluate(() => { window.__workflowWrites = 0; });
    const firstCard = workspace.locator('.lattice-browser-asset').first();
    const placementCount = await page.locator('.system-workflow__placement').count();
    await firstCard.dblclick();
    assert.equal(await page.evaluate(() => window.__workflowWrites), 1);
    assert.equal(await page.locator('.system-workflow__placement').count(), placementCount + 1);

    await page.evaluate(() => { window.__workflowWrites = 0; });
    await workspace.getByLabel('Search').fill('MOUNTAIN SIGNAL II');
    const secondCard = workspace.locator('.lattice-browser-asset').first(); const cardBox = await secondCard.boundingBox();
    const canvasBox = await page.locator('.system-workflow__canvas').boundingBox();
    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    await page.mouse.down(); await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2, { steps: 6 });
    assert.equal(await workspace.getAttribute('data-placing'), 'true');
    await page.waitForTimeout(240);
    const placingOpacity = Number.parseFloat(await workspace.evaluate((node) => getComputedStyle(node).opacity));
    assert.ok(placingOpacity < 0.2, `Library should recede while placing; received opacity ${placingOpacity}`);
    assert.equal(await secondCard.getAttribute('data-workflow-dragging'), '');
    assert.equal(await page.locator('.system-workflow__placement-preview').count(), 1);
    assert.equal(await page.locator('.system-workflow__placement-preview img').count(), 1);
    const previewBox = await page.locator('.system-workflow__placement-preview').boundingBox();
    assert.ok(Math.abs(previewBox.width / previewBox.height - 1) < 0.01, 'square source keeps a square placement preview');
    assert.ok(Number.parseFloat(await secondCard.evaluate((node) => getComputedStyle(node).opacity)) < 0.5);
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'review-library-drag-1440x900.png') });
    await page.mouse.up();
    assert.equal(await page.evaluate(() => window.__workflowWrites), 1);
    assert.equal(await page.locator('.system-workflow__placement').count(), placementCount + 2);
    assert.equal(await page.locator('.system-workflow__placement-preview').count(), 0);
    const placedBox = await page.locator('.system-workflow__placement').last().boundingBox();
    assert.ok(Math.abs(placedBox.width / placedBox.height - 1) < 0.01, 'square source keeps its ratio after placement');

    // Cards own dragging and suppress text selection. Native search input keeps
    // a real selectable string for the workspace-close cleanup regression.
    const search = workspace.getByLabel('Search');
    await search.fill('MOUNTAIN SIGNAL II');
    await search.focus(); await page.keyboard.press('Control+a');
    assert.deepEqual(await search.evaluate(node => [node.selectionStart, node.selectionEnd]), [0, 'MOUNTAIN SIGNAL II'.length],
      'Library retains native text selection in its search input');
    assert.equal(await page.evaluate(() => globalThis.getSelection()?.toString()), 'MOUNTAIN SIGNAL II');
    for (let index = 0; index < 4 && await workspace.count(); index += 1) await page.keyboard.press('Escape');
    await workspace.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => globalThis.getSelection()?.rangeCount || 0), 0, 'closing a workspace clears native browser text selection');
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Library');
    assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);

    await trigger.click(); await workspace.waitFor();
    assert.equal(await workspace.getByLabel('Card size').inputValue(), '220', 'Library remembers card size across close and reopen');
    const libraryQueryBeforeDiscover = await workspace.getByLabel('Search').inputValue();
    assert.equal(await workspace.locator('.system-workflow__workspace-labels input').isChecked(), true, 'Library remembers label visibility across close and reopen');
    for (let index = 0; index < 4 && await workspace.count(); index += 1) await page.keyboard.press('Escape');
    await workspace.waitFor({ state: 'detached' });

    const discoverTrigger = page.getByRole('button', { name: 'Discover', exact: true });
    await discoverTrigger.click();
    const discover = page.locator('.public-entry-portal');
    await discover.getByRole('region', { name: 'Published worlds' }).waitFor();
    const worldSearch = discover.getByLabel('Search published worlds', { exact: true });
    await worldSearch.fill('no such published world');
    assert.equal(await workspace.count(), 0, 'Discover does not reopen the Library workspace');
    await page.setViewportSize({ width: 390, height: 720 });
    const directoryBounds = await discover.boundingBox();
    assert.ok(directoryBounds.x >= 0 && directoryBounds.width <= 390 && directoryBounds.y >= 0,
      'Discover fits the narrow viewport');
    await discover.getByRole('button', { name: 'Return to workspace', exact: true }).click();
    await discover.waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Discover');
    assert.equal(await discoverTrigger.evaluate(node => node === document.activeElement), true);
    await trigger.click(); await workspace.waitFor();
    await page.waitForFunction(() => document.querySelector('[aria-label="Library workspace"]')?.closest('[data-system-workflow-panel]')?.dataset.panelPhase === 'open');
    assert.equal(await workspace.getByLabel('Search').inputValue(), libraryQueryBeforeDiscover, 'Discover search does not change the Library query');
    assert.equal(await workspace.getByLabel('Card size').inputValue(), '220', 'Discover does not change Library density');
    const narrowBounds = await workspace.boundingBox();
    assert.ok(narrowBounds.x >= 0 && narrowBounds.y >= 0 && narrowBounds.width > 0 && narrowBounds.height > 0
      && narrowBounds.x + narrowBounds.width <= 390 && narrowBounds.y + narrowBounds.height <= 720,
    'narrow Library remains within the viewport');
    assert.equal(await workspace.locator('.system-workflow__local-rail').evaluate((node) => node.scrollWidth === node.clientWidth), true, 'narrow Library rail has no trailing close-control block');
    assert.equal(await workspace.locator('.system-workflow__workspace-rail-controls').evaluate((rail) => {
      const children = [...rail.children].map((node) => node.getBoundingClientRect());
      const railBox = rail.getBoundingClientRect();
      return children.slice(1, 5).every((box) => box.top < children[0].top)
        && Math.abs(children[5].right - railBox.right) < 1
        && getComputedStyle(rail.children[5]).borderRightWidth === '0px';
    }), true, 'narrow Library puts controls above search and closes flush against one outer edge');
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'review-library-390x720.png') });

    await page.setViewportSize({ width: 1440, height: 900 });
    assert.equal(await workspace.locator('.system-workflow__library-tree-category').count(), 3, 'category creation survived Library and Discover roundtrips');
    while (await workspace.locator('.system-workflow__library-tree-category').count()) {
      const category = workspace.locator('.system-workflow__library-tree-category > button').first();
      const name = await category.getAttribute('aria-label');
      await category.click({ button: 'right' });
      await page.getByRole('menu', { name: 'Category commands' }).getByRole('menuitem', { name: 'Delete', exact: true }).click();
      await workspace.getByRole('alertdialog', { name: 'Delete category ' + name, exact: true }).getByRole('button', { name: 'Delete ' + name, exact: true }).click();
    }
    assert.equal(await workspace.getByText('NO CATEGORIES', { exact: true }).count(), 0, 'an empty Library sidebar stays visually empty');

  } finally {
    await browser.close();
  }
});
