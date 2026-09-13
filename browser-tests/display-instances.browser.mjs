import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const origin = 'http://127.0.0.1:5186';
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('https://raw.githubusercontent.com/**', route => {
    const path = new URL(route.request().url()).pathname.split('/public/')[1];
    return route.fulfill({ path: `public/${path}` });
  });
  await page.route(`${origin}/__instances__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__instances__`);
  await page.evaluate(async () => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default;
    const { createRoot } = (await import('/@id/react-dom/client')).default;
    const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
    const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
    await import('/src/lattice/rendering/latticeMenuSurface.css');
    const storage = fixture.createOwnerSystemWorkflowReviewStorage();
    const root = createRoot(document.getElementById('root'));
    window.instances = { root, storage, profile: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE,
      getDraft: () => JSON.parse(storage.getItem(systemWorkflowDraftKey(fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE))) };
    const props = { profileAddress: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE, reviewStorage: storage,
      reviewAssets: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS, reviewCategories: [], reviewActivity: [], reviewDiscovery: [],
      reviewProfile: { name: 'Display review' } };
    instances.render = () => root.render(React.createElement(Runtime, props)); instances.render();
  });
  await page.locator('.system-workflow__presentation-board').waitFor();
  await page.mouse.click(15, 15, { button: 'right' });
  await page.getByRole('menuitem', { name: 'ADD', exact: true }).hover();
  await page.getByRole('menuitem', { name: 'DISPLAY MODULE', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.system-workflow__presentation-board').length === 2);
  const second = page.locator('[data-display-instance]').nth(1);
  await second.locator('.system-workflow__identity-strip').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'PORTRAIT 9:16', exact: true }).click();
  await page.waitForFunction(() => instances.getDraft().displays?.[0].geometry.columns === 18);
  await page.waitForTimeout(200);
  const ratios = await page.locator('.system-workflow__stage').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return r.width / r.height; }));
  assert.ok(ratios.some(ratio => Math.abs(ratio - 9 / 16) < .01), JSON.stringify(ratios));
  assert.ok(ratios.some(ratio => Math.abs(ratio - 16 / 9) < .01), JSON.stringify(ratios));
  const primaryCount = await page.evaluate(() => instances.getDraft().grids[0].placements.length);
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.getByRole('button', { name: 'ABYSSAL STUDY / INSCAPE STUDIES', exact: true }).dblclick();
  await page.waitForFunction(() => instances.getDraft().displays[0].grids[0].placements.length === 1);
  assert.equal(await page.evaluate(() => instances.getDraft().grids[0].placements.length), primaryCount);
  const placement = await page.evaluate(() => instances.getDraft().displays[0].grids[0].placements[0]);
  assert.ok(Math.abs(placement.column + placement.columnSpan / 2 - 9) <= .5);
  assert.ok(Math.abs(placement.row + placement.rowSpan / 2 - 16) <= .5);
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page.screenshot({ path: 'output/display-instances-wide.png' });
  await second.getByRole('button', { name: 'Minimize Display Module to shortcut', exact: true }).click();
  await second.getByRole('button', { name: 'Open DISPLAY 2', exact: true }).dblclick();
  await second.locator('.system-workflow__presentation-board').waitFor();
  await second.locator('.system-workflow__identity-strip').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'INCLUDE DISPLAY IN PUBLICATION', exact: true }).click();
  await page.evaluate(async () => {
    const React = (await import('/@id/react')).default;
    const { buildProfileDocumentV9 } = await import('/src/profileDocument/domain/profileDocumentV9Builder.js');
    const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const Visitor = (await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default;
    const { createDefaultWorkbenchPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
    const draft = instances.getDraft();
    const workbench = createDefaultWorkbenchPresentation();
    workbench.display.window = { left: 20, top: 80, width: 750, height: 460 };
    workbench.displays = [{ id: draft.displays[0].id, ...structuredClone(workbench.display), name: 'PORTRAIT',
      window: { left: 870, top: 80, width: 320, height: 607 } }];
    instances.document = buildProfileDocumentV9({ profileAddress: instances.profile, systemWorkflowDraft: draft,
      assetRecords: fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS, workbench });
    instances.root.render(React.createElement(Visitor, { document: instances.document }));
  });
  await page.waitForFunction(() => document.querySelectorAll('.visitor-grid-world .system-workflow__presentation-board').length === 2);
  await page.waitForTimeout(250);
  const visitorRatios = await page.locator('.system-workflow__stage').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return r.width / r.height; }));
  assert.ok(visitorRatios.some(ratio => Math.abs(ratio - 9 / 16) < .01));
  assert.equal(await page.locator('[data-embedded-display] .system-workflow__identity-primary strong').isVisible(), true);
  await page.screenshot({ path: 'output/display-instances-visitor-wide.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'output/display-instances-visitor-narrow.png' });
  const boxes = await page.locator('.system-workflow__presentation-board').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }));
  assert.ok(boxes.every(box => box.left >= 0 && box.right <= 391 && box.top >= 0 && box.bottom <= 845), JSON.stringify(boxes));
  assert.deepEqual(errors, []);
  console.log('Owner add and portrait passed', ratios);
} finally { await browser.close(); }
