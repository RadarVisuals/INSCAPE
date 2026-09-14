import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://raw.githubusercontent.com/**', route => {
    const path = new URL(route.request().url()).pathname.split('/public/')[1];
    return path ? route.fulfill({ path: `public/${path}` }) : route.abort();
  });
  await page.route(`${origin}/__context_menu__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__context_menu__`);
  await page.evaluate(async () => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default;
    const { createRoot } = await import('/@id/react-dom/client');
    const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
    const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
    await import('/src/lattice/rendering/latticeMenuSurface.css');
    const storage = fixture.createOwnerSystemWorkflowReviewStorage();
    const profile = fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE;
    const preferences = await import('/src/public/ownerSystemWorkflow/workbenchPreferences.js');
    preferences.saveWorkbenchPreferences(profile, { ...preferences.DEFAULT_WORKBENCH_PREFERENCES, surfaceId: 'carbon' });
    const root = createRoot(document.getElementById('root'));
    window.review = { root, storage, profile, getDraft: () => JSON.parse(storage.getItem(systemWorkflowDraftKey(profile))),
      dockVisible: () => preferences.loadWorkbenchPreferences(profile).dockVisible };
    const props = { profileAddress: profile, reviewStorage: storage, reviewAssets: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS,
      reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Menu review' } };
    review.render = key => root.render(React.createElement(Runtime, { ...props, key }));
    review.render('first');
  });
  await page.locator('.system-workflow__presentation-board').waitFor();
  const desktop = async (x = 15, y = 15) => page.mouse.click(x, y, { button: 'right' });
  const menu = () => page.getByRole('menu', { name: 'Workbench commands', exact: true });
  const rootLabels = () => menu().locator(':scope > button').allTextContents();
  await desktop();
  assert.deepEqual((await rootLabels()).map(s => s.replace('›', '').trim()), ['ADD', 'HIDE DOCK']);
  await page.getByRole('menuitem', { name: 'ADD', exact: true }).hover();
  await page.getByRole('menuitem', { name: 'DISPLAY MODULE', exact: true }).waitFor();
  assert.equal(await page.getByRole('menuitem', { name: 'METADATA MODULE', exact: true }).count(), 0);
  // Cross the touching boundary very slowly, including a pause at the seam.
  const rootBounds = await menu().boundingBox();
  const childBounds = await page.getByRole('menu', { name: 'ADD options' }).boundingBox();
  assert.ok(Math.abs(rootBounds.x + rootBounds.width - childBounds.x) <= 1);
  await page.mouse.move(rootBounds.x + rootBounds.width - 2, childBounds.y + 18);
  await page.mouse.move(childBounds.x, childBounds.y + 18);
  await page.waitForTimeout(500);
  assert.equal(await page.getByRole('menuitem', { name: 'DISPLAY MODULE', exact: true }).isVisible(), true);
  await page.screenshot({ path: 'output/workbench-menu-wide.png' });
  await page.keyboard.press('Escape');
  const before = await page.evaluate(() => JSON.stringify(review.getDraft()));
  const height = await page.locator('[data-presentation-workbench]').first().evaluate(node => node.clientHeight);
  await desktop();
  await page.getByRole('menuitem', { name: 'HIDE DOCK', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.system-workflow__global-bar') && !review.dockVisible());
  assert.equal(await page.locator('[data-presentation-workbench]').first().evaluate(node => node.clientHeight), height + 42);
  assert.equal(await page.evaluate(() => JSON.stringify(review.getDraft())), before);
  await page.evaluate(() => review.render('remounted'));
  await page.locator('.system-workflow__presentation-board').waitFor();
  assert.equal(await page.locator('.system-workflow__global-bar').count(), 0);
  await page.locator('main.system-workflow').focus();
  await page.keyboard.press('Shift+F10');
  await page.getByRole('menuitem', { name: 'SHOW DOCK', exact: true }).click();
  await page.locator('.system-workflow__global-bar').waitFor();
  await desktop();
  await page.keyboard.press('ArrowRight');
  await page.getByRole('menu', { name: 'ADD options' }).waitFor();
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.getByRole('menu', { name: 'ADD options' }).count(), 0);
  await page.keyboard.press('Escape');
  // Add a second Display and change only its format from its title bar.
  await desktop();
  await page.getByRole('menuitem', { name: 'ADD', exact: true }).click();
  await page.getByRole('menuitem', { name: 'DISPLAY MODULE', exact: true }).click();
  await page.waitForFunction(() => review.getDraft().displays?.length === 1);
  const second = page.locator('[data-display-instance]').nth(1);
  const firstGeometry = await page.evaluate(() => review.getDraft().geometry);
  await second.locator('.system-workflow__identity-strip').click({ button: 'right' });
  assert.equal(await page.getByRole('menuitem', { name: 'ADD', exact: true }).count(), 0);
  await page.getByRole('menuitem', { name: 'FORMAT', exact: true }).click();
  assert.equal(await page.getByRole('menuitemcheckbox', { name: 'LANDSCAPE 16:9', exact: true }).getAttribute('aria-checked'), 'true');
  await page.getByRole('menuitemcheckbox', { name: 'PORTRAIT 9:16', exact: true }).click();
  await page.waitForFunction(() => review.getDraft().displays[0].geometry.rows === 32);
  assert.deepEqual(await page.evaluate(() => review.getDraft().geometry), firstGeometry);
  await second.getByRole('button', { name: 'Minimize Display Module to shortcut', exact: true }).click();
  await second.locator('.system-workflow__desktop-shortcut').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'FORMAT', exact: true }).click();
  assert.equal(await page.getByRole('menuitemcheckbox', { name: 'PORTRAIT 9:16', exact: true }).getAttribute('aria-checked'), 'true');
  await page.screenshot({ path: 'output/display-format-menu.png' });
  await page.getByRole('menuitemcheckbox', { name: 'LANDSCAPE 16:9', exact: true }).click();
  await page.waitForFunction(() => review.getDraft().displays[0].geometry.columns === 32);
  // Narrow and edge-opening menus remain inside the viewport and traversable.
  await page.setViewportSize({ width: 390, height: 844 });
  await desktop(380, 12);
  await page.getByRole('menuitem', { name: 'ADD', exact: true }).hover();
  await page.getByRole('menu', { name: 'ADD options' }).waitFor();
  for (const bounds of await page.locator('[role="menu"]').evaluateAll(nodes => nodes.map(n => {
    const r = n.getBoundingClientRect(); return { left: r.left, right: r.right, bottom: r.bottom };
  }))) assert.ok(bounds.left >= 0 && bounds.right <= 390 && bounds.bottom <= 844, JSON.stringify(bounds));
  await page.screenshot({ path: 'output/workbench-menu-narrow.png' });
  await page.keyboard.press('Escape');
  await desktop(380, 12);
  await page.getByRole('menuitem', { name: 'HIDE DOCK', exact: true }).click();
  assert.equal(await page.locator('[data-presentation-workbench]').first().evaluate(node => node.clientHeight), 844);
  await page.screenshot({ path: 'output/workbench-hidden-dock-narrow.png' });
  assert.deepEqual(errors, []);
  console.log('Workbench menu: gap traversal, dock persistence/layout, keyboard, scoped Display formats and narrow bounds passed.');
} finally { await browser.close(); }
