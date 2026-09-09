import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5174';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

test('owner Display opens, browses and returns focus through the shared inspection', { timeout: 30_000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10_000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/development/owner/system-workflow`);
    const first = page.getByRole('button', { name: /Select ABYSSAL STUDY/ });
    await first.dblclick();
    await page.getByRole('dialog', { name: 'ABYSSAL STUDY focus viewer' }).waitFor();
    await page.getByRole('button', { name: 'Next artwork', exact: true }).click();
    await page.getByRole('dialog', { name: 'MOUNTAIN SIGNAL II focus viewer' }).waitFor();
    await page.screenshot({ path: '.browser-test-runtime/owner-shared-inspection.png' });
    await page.keyboard.press('Escape');
    await page.locator('.lattice-focus-viewer').waitFor({ state: 'detached' });
    assert.equal(await page.getByRole('button', { name: /Select MOUNTAIN SIGNAL II/ }).evaluate(node => node === document.activeElement), true);
    assert.equal(await page.locator('.system-workflow__placement[data-viewing]').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

async function withSession(run) {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(10_000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route(`${origin}/__inspection_session__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__inspection_session__`);
    await page.evaluate(async () => {
      const React = (await import('/@id/react')).default;
      const { createRoot } = (await import('/@id/react-dom/client')).default;
      const useInspection = (await import('/src/public/ownerSystemWorkflow/useDisplayInspection.js')).default;
      const root = createRoot(document.getElementById('root'));
      const items = [{ id: 'last', navigationOrder: 3 }, { id: 'missing', navigationOrder: 2 }, { id: 'first', navigationOrder: 1 }];
      const api = window.sessionTest = { scope: 'profile-a:grid-a', items, deferred: false, pending: [], events: [] };
      function Harness() {
        const refs = React.useRef(new Map());
        const viewer = useInspection({ scope: api.scope, items: api.items,
          getElement: id => refs.current.get(id), getEntry: id => id !== 'missing' ? { id } : null,
          prepare: api.deferred ? () => new Promise((resolve, reject) => api.pending.push({ resolve, reject })) : undefined,
          onOpen: id => api.events.push(['open', id]), onNavigate: id => api.events.push(['navigate', id]),
          onClose: () => api.events.push(['close']),
        });
        api.viewer = viewer;
        return React.createElement('div', null, api.items.map(item => React.createElement('button', {
          key: item.id, ref: node => node ? refs.current.set(item.id, node) : refs.current.delete(item.id),
          onClick: () => viewer.open(item.id),
        }, item.id)));
      }
      api.render = () => root.render(React.createElement(React.StrictMode, null, React.createElement(Harness)));
      api.unmount = () => root.unmount(); api.render();
    });
    await page.getByRole('button', { name: 'first', exact: true }).waitFor();
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

test('shared inspection orders available artwork and owns the complete return lifecycle', () => withSession(async page => {
  await page.getByRole('button', { name: 'missing', exact: true }).click();
  assert.equal(await page.evaluate(() => sessionTest.viewer.placementId), null);
  await page.getByRole('button', { name: 'first', exact: true }).click();
  assert.deepEqual(await page.evaluate(() => {
    const v = sessionTest.viewer; return [v.placementId, v.position, v.total, v.sourcePlacementId, v.atmosphereActive];
  }), ['first', 0, 2, null, true]);
  await page.evaluate(() => sessionTest.viewer.present()); await settle(page);
  assert.equal(await page.evaluate(() => sessionTest.viewer.sourcePlacementId), 'first');
  await page.evaluate(() => sessionTest.viewer.navigate(-1)); await settle(page);
  assert.equal(await page.evaluate(() => sessionTest.viewer.placementId), 'last');
  await page.evaluate(() => sessionTest.viewer.navigate(1)); await settle(page);
  assert.equal(await page.evaluate(() => sessionTest.viewer.returnFocus.textContent), 'first');
  await page.evaluate(() => sessionTest.viewer.beginReturn()); await settle(page);
  assert.deepEqual(await page.evaluate(() => [sessionTest.viewer.atmosphereActive, sessionTest.viewer.sourcePlacementId]), [false, 'first']);
  await page.evaluate(() => sessionTest.viewer.revealSource()); await settle(page);
  assert.equal(await page.evaluate(() => sessionTest.viewer.sourcePlacementId), null);
  await page.evaluate(() => sessionTest.viewer.close()); await settle(page);
  assert.equal(await page.evaluate(() => sessionTest.viewer.placementId), null);
  assert.deepEqual(await page.evaluate(() => sessionTest.events), [['open', 'first'], ['navigate', 'last'], ['navigate', 'first'], ['close']]);
}));

for (const interruption of ['grid', 'profile', 'close', 'remove', 'unmount', 'reject']) {
  test(`pending inspection cannot reopen after ${interruption}`, () => withSession(async page => {
    await page.evaluate(() => { sessionTest.deferred = true; sessionTest.render(); }); await settle(page);
    await page.getByRole('button', { name: 'first', exact: true }).click();
    await page.evaluate(interruption => {
      const s = sessionTest;
      if (interruption === 'grid') { s.scope = 'profile-a:grid-b'; s.render(); }
      if (interruption === 'profile') { s.scope = 'profile-b:grid-a'; s.render(); }
      if (interruption === 'close') s.viewer.close();
      if (interruption === 'remove') { s.items = s.items.filter(item => item.id !== 'first'); s.render(); }
      if (interruption === 'unmount') s.unmount();
    }, interruption); await settle(page);
    await page.evaluate(interruption => interruption === 'reject'
      ? sessionTest.pending[0].reject(new Error('Media unavailable')) : sessionTest.pending[0].resolve(true), interruption);
    await settle(page);
    assert.deepEqual(await page.evaluate(() => sessionTest.events), []);
    assert.equal(await page.evaluate(() => sessionTest.viewer.placementId), null);
  }));
}

test('latest opening wins and a later scope change does not invoke owner restoration', () => withSession(async page => {
  await page.evaluate(() => { sessionTest.deferred = true; sessionTest.render(); }); await settle(page);
  await page.getByRole('button', { name: 'first', exact: true }).click();
  await page.getByRole('button', { name: 'last', exact: true }).click();
  await page.evaluate(() => sessionTest.pending[1].resolve(true)); await settle(page);
  await page.evaluate(() => sessionTest.pending[0].resolve(true)); await settle(page);
  assert.equal(await page.evaluate(() => sessionTest.viewer.placementId), 'last');
  await page.evaluate(() => { sessionTest.scope = 'profile-b:grid-b'; sessionTest.render(); }); await settle(page);
  assert.equal(await page.evaluate(() => sessionTest.viewer.placementId), null);
  assert.deepEqual(await page.evaluate(() => sessionTest.events), [['open', 'last']]);
}));

test('owner adapter restores the original editing selection after browsing artwork', () => withSession(async page => {
  await page.evaluate(async () => {
    sessionTest.unmount();
    const React = (await import('/@id/react')).default;
    const { createRoot } = (await import('/@id/react-dom/client')).default;
    const useOwner = (await import('/src/public/ownerSystemWorkflow/useOwnerSystemWorkflowFocusViewer.js')).default;
    const placements = ['first', 'last'].map((id, navigationOrder) => ({ id, navigationOrder, stableAssetId: id }));
    const assetsById = new Map(placements.map(item => [item.id, { src: '/fixture.svg', width: 100, height: 100 }]));
    function Owner() {
      const [selection, replaceSelection] = React.useState(['first', 'last']);
      const controller = { draft: { profileAddress: 'profile-a' }, selectedGridId: 'grid-a',
        selectedGrid: { placements }, selectedPlacementIds: selection, replaceSelection };
      const viewer = useOwner({ assetsById, controller, resolveAssetDimensions: async () => ({ width: 100, height: 100 }) });
      sessionTest.viewer = viewer; sessionTest.selection = selection;
      return React.createElement('div', null, placements.map(item => React.createElement('button', {
        key: item.id, ref: node => viewer.registerPlacement(item.id, node), onClick: () => viewer.open(item.id),
      }, item.id)));
    }
    createRoot(document.getElementById('root')).render(React.createElement(Owner));
  });
  await page.getByRole('button', { name: 'first', exact: true }).click(); await settle(page);
  assert.deepEqual(await page.evaluate(() => sessionTest.selection), ['first']);
  await page.evaluate(() => sessionTest.viewer.navigate(1)); await settle(page);
  assert.deepEqual(await page.evaluate(() => sessionTest.selection), ['last']);
  await page.evaluate(() => sessionTest.viewer.close()); await settle(page);
  assert.deepEqual(await page.evaluate(() => sessionTest.selection), ['first', 'last']);
}));
