import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';

// Audit probes describe observed defects, not desired regression behavior.
const origin = process.env.INSCAPE_IMAGE_ROOT || 'http://127.0.0.1:5189';
test('Image audit: independent commits, unavailable media and minimum-size controls', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const results = {};
  const output = 'output/image-audit-2026-09-22';
  await mkdir(output, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.route('https://audit.test/good.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#b23c49"/><circle cx="250" cy="220" r="140" fill="#e9d799"/></svg>' }));
    await page.route(`${origin}/__image_audit__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__image_audit__`);
    await page.evaluate(async () => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default;
      const { createRoot } = (await import('/@id/react-dom/client')).default;
      const { createSystemWorkflowDraftStore, systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      const { addImageModule } = await import('/src/imageModule/imageModuleSession.js');
      const { createProfileDocumentV9AssetResolver } = await import('/src/profileDocument/domain/profileDocumentV9Asset.js');
      const { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS: assets } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
      const ImageWorkbench = (await import('/src/imageModule/ImageWorkbench.jsx')).default;
      const { WorkbenchViewProvider, useWorkbenchView } = await import('/src/public/ownerSystemWorkflow/WorkbenchView.jsx');
      const { ContextToolbarProvider, ContextToolbar } = await import('/src/public/ownerSystemWorkflow/ContextToolbar.jsx');
      await import('/src/inscapeTokens.css');
      await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
      const profile = `0x${'1'.repeat(40)}`;
      const storage = new Map();
      const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage: { getItem: k => storage.get(k) ?? null, setItem: (k,v) => storage.set(k,v) } });
      const id = addImageModule(store, profile);
      const asset = createProfileDocumentV9AssetResolver(assets, { compactContentReference: false })(assets[0].id);
      asset.media = { ...asset.media, url: 'https://audit.test/good.svg', width: 640, height: 480 };
      const draft = store.getDraft();
      draft.imageModules[0].sides = ['one', 'two'].map(key => ({ id: `side:${key}`, asset, crop: { x: .5, y: .5, zoom: 1 }, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } }));
      store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() });
      window.auditStore = store;
      window.auditCommit = patch => { const d = store.getDraft(); Object.assign(d.imageModules[0], patch); return store.commitCompletedOperation(d, { expectedGeneration: store.getGeneration() }); };
      window.auditUnrelated = () => addImageModule(store, profile);
      window.auditExternalChange = () => { const d = store.getDraft(); d.imageModules[1].name = 'Changed elsewhere'; storage.set(systemWorkflowDraftKey(profile), JSON.stringify(d)); };
      function CameraProbe() { window.auditZoom = useWorkbenchView().setScale; return null; }
      function Fixture() {
        const d = React.useSyncExternalStore(store.subscribe, store.getSnapshot);
        return React.createElement(WorkbenchViewProvider, null,
          React.createElement(CameraProbe),
          React.createElement(ContextToolbarProvider, { target: id },
            React.createElement(ImageWorkbench, { records: d.imageModules.slice(0, 1), store, profileAddress: profile }),
            React.createElement(ContextToolbar)));
      }
      createRoot(document.getElementById('root')).render(React.createElement(Fixture));
    });
    const module = page.locator('[data-image-module]').first();
    const canvas = module.locator('.image-module__canvas');
    const dock = page.locator('[data-context-tools]');
    await dock.getByRole('button', { name: 'Crop', exact: true }).click();
    await dock.getByRole('slider').fill('2');
    assert.equal(await canvas.getAttribute('data-cropping'), 'true');
    const savedBefore = await page.evaluate(() => window.auditStore.getDraft().imageModules[0]);
    await page.evaluate(() => window.auditUnrelated());
    await page.waitForFunction(() => !document.querySelector('.image-module__canvas').hasAttribute('data-cropping'));
    assert.deepEqual(await page.evaluate(() => window.auditStore.getDraft().imageModules[0]), savedBefore);
    results.unrelatedCommit = { cropCancelled: true, authoredImageUnchanged: true };
    await canvas.click();
    await page.getByRole('dialog', { name: 'Inspect Image' }).waitFor();
    await page.evaluate(() => window.auditUnrelated());
    await page.getByRole('dialog', { name: 'Inspect Image' }).waitFor({ state: 'detached' });
    results.unrelatedCommit.inspectionClosed = true;

    await page.evaluate(() => { const d = window.auditStore.getDraft(); d.imageModules[0].sides[0].asset.media.url = 'https://audit.test/missing.png'; window.auditCommit({ sides: d.imageModules[0].sides }); });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    results.unavailable = { alerts: await module.getByRole('alert').count(), status: await module.getByRole('status').count(), label: await canvas.getAttribute('aria-label') };
    assert.equal(results.unavailable.alerts + results.unavailable.status, 0);
    await canvas.click();
    await page.getByRole('dialog', { name: 'Inspect Image' }).waitFor();
    await page.screenshot({ path: `${output}/missing-media.png` });
    results.unavailable.dialogAlerts = await page.getByRole('dialog').getByRole('alert').count();
    await page.keyboard.press('Escape');

    await page.evaluate(() => { const d = window.auditStore.getDraft(); d.imageModules[0].sides[0].asset.media.url = 'https://audit.test/good.svg'; window.auditCommit({ width: 32, height: 32, sides: d.imageModules[0].sides }); });
    await canvas.focus();
    results.small = await module.evaluate(node => {
      const canvas = node.querySelector('.image-module__canvas').getBoundingClientRect();
      const next = node.querySelector('.image-module__next').getBoundingClientRect();
      const header = node.querySelector('.image-module__header').getBoundingClientRect();
      return { canvas: canvas.toJSON(), next: next.toJSON(), header: header.toJSON(), nextCenterHit: document.elementFromPoint(next.x + next.width/2, next.y + next.height/2)?.outerHTML.slice(0, 160) };
    });
    assert.ok(results.small.next.left < results.small.canvas.left);
    await page.screenshot({ path: `${output}/minimum-canvas-wide.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${output}/minimum-canvas-narrow.png` });
    await page.evaluate(() => window.auditZoom(.25));
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    results.small.zoomed = await canvas.evaluate(node => {
      const r = node.getBoundingClientRect(); let accessiblePixels = 0;
      for (let x = r.left + .5; x < r.right; x++) for (let y = r.top + .5; y < r.bottom; y++) if (document.elementFromPoint(x,y) === node) accessiblePixels++;
      return { width: r.width, height: r.height, accessiblePixels };
    });
    await page.evaluate(() => window.auditExternalChange());
    await dock.getByRole('spinbutton', { name: 'Image width' }).fill('64');
    for (let attempt = 0; attempt < 3; attempt++) await dock.getByRole('button', { name: 'Set size' }).click();
    results.externalChange = { message: await dock.getByRole('alert').innerText(), widthAfterThreeAttempts: await page.evaluate(() => window.auditStore.getDraft().imageModules[0].width) };
    assert.equal(results.externalChange.widthAfterThreeAttempts, 32);
    assert.deepEqual(errors, []);
    await writeFile(`${output}/probes.json`, JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
});
