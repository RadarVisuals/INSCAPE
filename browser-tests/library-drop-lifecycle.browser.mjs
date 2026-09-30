import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function mount(page, { unknownDimensions = false, kind = 'display' } = {}) {
  // Keep the thumbnail pending too: otherwise its onLoad fills intrinsic size
  // before the gesture and would not exercise genuinely unknown dimensions.
  if (unknownDimensions) await page.route('**/assets/actors/abyssal_eye/full.webp', () => {});
  await page.route(`${origin}/__library_lifecycle__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__library_lifecycle__`);
  await page.evaluate(async ({ unknownDimensions, kind }) => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
    const Library = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowLibraryWorkspace.jsx')).default;
    await import('/src/index.css'); await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
    const calls = [], pending = [];
    let target;
    const destinationNode = document.createElement('div');
    destinationNode.style.cssText = 'position:fixed;left:1100px;top:100px;width:250px;height:300px';
    if (kind === 'blocked') destinationNode.dataset.workbenchModule = 'blocked';
    document.body.append(destinationNode);
    const makeTarget = grid => {
      const candidate = { node: destinationNode, isCurrent: () => target === candidate,
        placeAsset: (_asset, dimensions, destination) => { if (!candidate.isCurrent()) return false; calls.push({ grid, dimensions, destination }); return true; },
        previewAt: (point, dimensions) => candidate.isCurrent() && point.x > 1050 && dimensions ? { destination: { column: 1, row: 2, columnSpan: dimensions.width / 100, rowSpan: dimensions.height / 100 }, rectangle: { left: 1100, top: 100, width: 100, height: 100 } } : null };
      return candidate;
    };
    target = makeTarget('first');
    const targets = { current: { captureTarget: () => target, targetAt: point => kind !== 'workbench' && point.x > 1050 ? target : null, placeAsset: (...args) => target.placeAsset(...args), previewAt: (...args) => {
      if (kind === 'workbench') return null;
      const result = target.previewAt(...args); return result && { ...result, target };
    } } };
    window.routeProbe = { calls, pending, retarget: () => { target = makeTarget('second'); }, removeBlock: () => destinationNode.remove(), resolve: () => pending.splice(0).forEach(resolve => resolve({ width: 200, height: 100 })) };
    const asset = { id: 'fixture:asset', stableAssetId: 'fixture:asset', title: 'Delayed image', collection: 'Fixture', placeable: true,
      src: '/assets/actors/abyssal_eye/full.webp', previewCandidates: ['/assets/actors/abyssal_eye/full.webp'], mediaType: 'image', ...(unknownDimensions ? {} : { width: 100, height: 100 }) };
    const alternate = { current: { targetAt: point => point.x > 1050 ? target : null, has: candidate => candidate === target } };
    createRoot(document.getElementById('root')).render(React.createElement('main', { className: 'system-workflow' },
      React.createElement(Library, { phase: 'open', placementScope: 'profile:primary-grid', placementTargetRef: targets,
        workbenchImageTargetRef: { current: { targetAt: point => kind === 'workbench' && point.x > 1050 ? target : null } },
        ...(kind === 'module' ? { moduleAssetTargetRef: alternate } : {}), shortcutTargetRef: kind === 'shortcut' ? alternate : { current: null }, workspaceRef: { current: null },
        resolveAssetDimensions: () => new Promise(resolve => pending.push(resolve)), data: { ownerContext: 'profile', assets: [asset], categories: [], usedAssetIds: [] }, menuSurface: 'mist' })));
  }, { unknownDimensions, kind });
  await page.getByRole('button', { name: 'Delayed image / Fixture', exact: true }).waitFor();
}

for (const activation of ['double click', 'pointer release']) test(`Library ${activation} cannot switch Display Grid while image dimensions load`, { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await mount(page);
    const card = page.getByRole('button', { name: 'Delayed image / Fixture', exact: true });
    if (activation === 'double click') await card.dblclick();
    else {
      const box = await card.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
      await page.mouse.move(1200, 200, { steps: 4 }); await page.mouse.up();
    }
    await page.evaluate(() => { routeProbe.retarget(); routeProbe.resolve(); }); await settle(page);
    assert.deepEqual(await page.evaluate(() => routeProbe.calls), [], 'stale request must not author into a later Grid');
    await card.dblclick(); await page.evaluate(() => routeProbe.resolve()); await settle(page);
    const calls = await page.evaluate(() => routeProbe.calls);
    assert.equal(calls.length, 1, 'fresh activation still succeeds once');
    assert.equal(calls[0].grid, 'second');
  } finally { await browser.close(); }
});

for (const scenario of ['unknown dimensions', 'workbench unknown dimensions', 'navigate before release', 'cancel after release', 'module retarget', 'shortcut retarget', 'blocked module removed', 'click without movement']) test(`Library delayed drop: ${scenario}`, { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await mount(page, { unknownDimensions: scenario.includes('unknown dimensions'), kind: scenario.split(' ')[0] });
    const card = page.getByRole('button', { name: 'Delayed image / Fixture', exact: true });
    const box = await card.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    if (scenario !== 'click without movement') await page.mouse.move(1200, 200, { steps: 4 });
    if (scenario === 'navigate before release') await page.evaluate(() => routeProbe.retarget());
    await page.mouse.up();
    if (scenario === 'cancel after release') await page.keyboard.press('Escape');
    if (scenario.endsWith('retarget')) await page.evaluate(() => routeProbe.retarget());
    if (scenario === 'blocked module removed') await page.evaluate(() => routeProbe.removeBlock());
    await page.evaluate(() => routeProbe.resolve()); await settle(page);
    const calls = await page.evaluate(() => routeProbe.calls);
    if (scenario.includes('unknown dimensions') || scenario === 'navigate before release') {
      assert.equal(calls.length, 1);
      assert.equal(calls[0].grid, scenario === 'navigate before release' ? 'second' : 'first');
      assert.equal(calls[0].destination.columnSpan, 2, 'resolved dimensions own final geometry');
      assert.equal(calls[0].destination.rowSpan, 1);
    } else assert.deepEqual(calls, [], 'cancelled/stale routes never redirect or partially place');
    assert.equal(await card.getAttribute('data-workflow-dragging'), null);
    assert.equal(await page.locator('.system-workflow__placement-preview').count(), 0);
  } finally { await browser.close(); }
});
