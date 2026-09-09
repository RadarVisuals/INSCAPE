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
    await page.evaluate(() => { window.__workflowWrites = 0; addEventListener('inscape:review-storage-write', () => { window.__workflowWrites += 1; }); });
    const trigger = page.getByRole('button', { name: 'Library', exact: true });
    await trigger.click();
    const workspace = page.getByRole('region', { name: 'Library workspace' });
    await workspace.waitFor();
    await page.waitForFunction(() => document.querySelector('[aria-label="Library workspace"]')?.closest('[data-system-workflow-panel]')?.dataset.panelPhase === 'open');
    await page.waitForFunction(() => document.querySelectorAll('.system-workflow__library .lattice-browser-asset').length === 7);
    const bounds = await workspace.boundingBox();
    assert.deepEqual(bounds, { x: 18, y: 18, width: 980, height: 822 });
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
    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    await page.mouse.down(); await page.mouse.move(1210, 180, { steps: 6 });
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

    await workspace.getByLabel('Search').fill('MOUNTAIN SIGNAL II');
    assert.equal(await workspace.evaluate((node) => {
      const text = node.querySelector('.lattice-browser-asset__record strong')?.firstChild;
      const selection = globalThis.getSelection();
      if (!text || !selection) return false;
      const range = document.createRange();
      range.selectNodeContents(text);
      selection.removeAllRanges();
      selection.addRange(range);
      return selection.rangeCount === 1 && selection.toString().length > 0;
    }), true, 'Library text can still be selected while the workspace is open');

    for (let index = 0; index < 4 && await workspace.count(); index += 1) await page.keyboard.press('Escape');
    await workspace.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => globalThis.getSelection()?.rangeCount || 0), 0, 'closing a workspace clears native browser text selection');
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Library');
    assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);

    await trigger.click(); await workspace.waitFor();
    assert.equal(await workspace.getByLabel('Card size').inputValue(), '220', 'Library remembers card size across close and reopen');
    assert.equal(await workspace.locator('.system-workflow__workspace-labels input').isChecked(), true, 'Library remembers label visibility across close and reopen');
    for (let index = 0; index < 4 && await workspace.count(); index += 1) await page.keyboard.press('Escape');
    await workspace.waitFor({ state: 'detached' });

    await page.getByRole('button', { name: 'Discover', exact: true }).click();
    const discover = page.getByRole('region', { name: 'Discover directory' });
    await discover.waitFor();
    assert.deepEqual(await discover.getByLabel('Profile card size').evaluate((node) => [node.min, node.max, node.step]), ['68', '420', '1'], 'Discover uses the same fine thumbnail density range as Library');
    assert.deepEqual(await discover.getByRole('button', { name: 'All people', exact: true }).evaluate((node) => {
      const style = getComputedStyle(node); return [style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight];
    }), ['"Inscape Sora", sans-serif', '11px', '500', '12.1px'], 'Discover sidebar uses the canonical loaded label face and weight');
    const discoverCreate = discover.getByRole('button', { name: 'Create Group', exact: true });
    assert.equal(await discoverCreate.evaluate((node) => getComputedStyle(node).backgroundColor), libraryCreateColor, 'Library and Discover Create actions use the exact same color');
    assert.equal((await discoverCreate.textContent()).trim(), 'Create Group');
    assert.deepEqual(await discover.getByRole('button', { name: 'All people', exact: true }).evaluate((node) => {
      const style = getComputedStyle(node); const marker = getComputedStyle(node, '::before');
      return [style.boxShadow, marker.left, marker.width];
    }), ['none', '0px', '4px'], 'Discover selection uses the same shared four-pixel marker');
    assert.deepEqual(await discoverCreate.evaluate((node) => {
      const heading = node.parentElement; return [getComputedStyle(heading).borderBottomWidth, getComputedStyle(node).borderBottomWidth];
    }), ['0px', '1px'], 'Discover Create action uses the same canonical lower border');
    await discoverCreate.click();
    const groupDialog = discover.locator('form[aria-label="Create people group"]');
    await groupDialog.locator('input').fill('friends of Inscape');
    await groupDialog.locator('input').press('Enter');
    const createdGroup = discover.getByRole('button', { name: 'friends of Inscape', exact: true });
    assert.equal(await createdGroup.count(), 1, 'Discover preserves spaces and entered letter case');
    await createdGroup.click({ button: 'right' });
    await page.getByRole('menu', { name: 'People group commands' }).getByRole('menuitem', { name: 'Delete' }).click();
    const deleteGroupDialog = discover.getByRole('alertdialog', { name: 'Delete people group friends of Inscape' });
    assert.match(await deleteGroupDialog.textContent(), /friends of Inscape/);
    assert.equal(await deleteGroupDialog.getAttribute('class'), 'system-workflow__sidebar-delete', 'Discover deletion uses the shared inline sidebar confirmation');
    await deleteGroupDialog.getByRole('button', { name: 'Delete friends of Inscape', exact: true }).click();
    assert.equal(await discover.getByRole('button', { name: 'friends of Inscape', exact: true }).count(), 0,
      'confirming Discover group deletion removes its sidebar row');
    await discover.getByRole('button', { name: 'All people', exact: true }).click();
    const discoverResize = discover.getByRole('button', { name: 'Resize Browser navigation' });
    const discoverResizeBox = await discoverResize.boundingBox();
    await page.mouse.move(discoverResizeBox.x + discoverResizeBox.width / 2, discoverResizeBox.y + 40);
    await page.mouse.down(); await page.mouse.move(discoverResizeBox.x - 180, discoverResizeBox.y + 40); await page.mouse.up();
    assert.equal(await discover.getAttribute('data-sidebar-collapsed'), 'true');
    await discover.getByRole('button', { name: 'All people', exact: true }).hover();
    const discoverHoverLabel = discover.locator('.system-workflow__sidebar-hover-label');
    await discoverHoverLabel.waitFor();
    assert.equal(await discoverHoverLabel.textContent(), 'All people');
    assert.equal(await discoverHoverLabel.getAttribute('data-active'), 'true');
    await discover.getByLabel('Profile card size').fill('233');
    const discoverMediaBefore = await discover.locator('.system-workflow__discover-avatar img').first().boundingBox();
    await discover.locator('.system-workflow__workspace-labels input').uncheck();
    assert.deepEqual(await discover.locator('.system-workflow__discover-avatar img').first().boundingBox(), discoverMediaBefore, 'Discover labels do not inset or resize media');
    await discover.getByRole('button', { name: 'Close Discover' }).click();
    await discover.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Discover', exact: true }).click(); await discover.waitFor();
    assert.equal(await discover.getAttribute('data-sidebar-collapsed'), 'true', 'Discover remembers sidebar width across close and reopen');
    assert.equal(await discover.getByLabel('Profile card size').inputValue(), '233', 'Discover remembers card size across close and reopen');
    assert.equal(await discover.locator('.system-workflow__workspace-labels input').isChecked(), false, 'Discover remembers label visibility across close and reopen');
    await page.setViewportSize({ width: 390, height: 720 });
    await page.waitForFunction(() => document.querySelector('.system-workflow')?.dataset.layout === 'narrow');
    assert.equal(await discover.locator('.system-workflow__workspace-rail-controls').evaluate((rail) => {
      const children = [...rail.children].map((node) => node.getBoundingClientRect());
      const railBox = rail.getBoundingClientRect();
      return children.slice(1, 5).every((box) => box.top < children[0].top)
        && Math.abs(children[5].right - railBox.right) < 1
        && getComputedStyle(rail.children[5]).borderRightWidth === '0px';
    }), true, 'narrow Discover puts controls above search and closes flush against one outer edge');
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'review-discover-390x720.png') });
    await discover.getByRole('button', { name: 'Close Discover' }).click(); await discover.waitFor({ state: 'detached' });

    await trigger.click(); await workspace.waitFor();
    await page.waitForFunction(() => document.querySelector('[aria-label="Library workspace"]')?.closest('[data-system-workflow-panel]')?.dataset.panelPhase === 'open');
    assert.deepEqual(await workspace.boundingBox(), { x: 8, y: 8, width: 374, height: 652 });
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
    while (await workspace.locator('.lattice-browser-category-list > button').count()) {
      const category = workspace.locator('.lattice-browser-category-list > button').first();
      await category.click({ button: 'right' });
      await page.getByRole('menu', { name: 'Category commands' }).getByRole('menuitem', { name: 'Delete', exact: true }).click();
      await workspace.getByRole('dialog', { name: 'Delete category' }).getByRole('button', { name: 'Delete', exact: true }).click();
    }
    assert.equal(await workspace.getByText('NO CATEGORIES', { exact: true }).count(), 0, 'an empty Library sidebar stays visually empty');

    await page.goto(`${ROOT}/owner-shell-system-prototype.html`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /^Library$/i }).click();
    await page.getByRole('region', { name: 'Library workspace' }).waitFor();
    if (SCREENSHOT_DIR) await page.screenshot({ path: resolve(SCREENSHOT_DIR, 'prototype-library-1440x900.png') });
  } finally {
    await browser.close();
  }
});
