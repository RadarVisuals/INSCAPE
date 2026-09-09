import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5186';
const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function fixture(run, width = 1280, reducedMotion = 'reduce') {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 800 }, reducedMotion });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route(`${origin}/__hardening__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__hardening__`);
    await page.evaluate(async reduced => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default;
      const { createRoot } = (await import('/@id/react-dom/client')).default;
      const Board = (await import('/src/public/ownerSystemWorkflow/PresentationBoardDefinitive.jsx')).default;
      const Viewer = (await import('/src/public/ownerSystemWorkflow/DisplayFocusViewer.jsx')).default;
      const useInspection = (await import('/src/public/ownerSystemWorkflow/useDisplayInspection.js')).default;
      const { DisplayStageSizeContext } = await import('/src/public/ownerSystemWorkflow/DisplayStageSizeContext.js');
      await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
      const style = document.createElement('style'); style.textContent = '.system-workflow{position:fixed;inset:0}.system-workflow__workbench{position:absolute;inset:0}'; document.head.append(style);
      const h = React.createElement;
      const source = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><circle cx="100" cy="100" r="85" fill="purple"/></svg>');
      const items = ['one', 'two', 'hidden'].map((id, navigationOrder) => ({ id, navigationOrder,
        inspectionMode: id === 'two' ? 'LIFT' : 'IN_PLACE', crop: null,
        mat: { enabled: false, color: '#000000', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
        backing: { enabled: false, color: '#000000' }, transparencyMode: 'AUTO',
        transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } }));
      const api = window.hardening = { available: true, changes: [], scope: 'a', source, items };
      const root = createRoot(document.getElementById('root'));
      function App() {
        const refs = React.useRef(new Map());
        const [scope, setScope] = React.useState('a'); api.setScope = setScope;
        const [available, setAvailable] = React.useState(true); api.setAvailable = setAvailable;
        const entries = React.useMemo(() => new Map(items.map(placement => [placement.id, {
          placement, accessibleLabel: placement.id, media: { src: source }, focusDimensions: { width: 200, height: 200 },
        }])), []);
        const viewer = useInspection({ scope, items, getElement: id => refs.current.get(id), getEntry: id => entries.get(id) });
        api.viewer = viewer;
        function Stage() {
          const size = React.useContext(DisplayStageSizeContext);
          return h('div', { style: { position: 'absolute', inset: 0 }, 'data-harness-size': JSON.stringify(size) }, items.slice(0, 2).map((item, i) => h('div', {
            className: 'system-workflow__placement', key: item.id, ref: node => refs.current.set(item.id, node), tabIndex: 0,
            style: { left: size.width * (.1 + i * .5), top: size.height * .15, width: size.width * .25, height: size.height * .6, zIndex: i + 1 },
            onDoubleClick: e => viewer.open(item.id, e.currentTarget), 'data-asset': item.id,
          }, h('img', { src: source, style: { width: '100%', height: '100%' } }))));
        }
        // Stable child type prevents source remounts during inspection updates.
        const StageRef = React.useRef(Stage);
        return h('main', { className: 'system-workflow' }, h(Board, {
          profileAddress: '0x1111111111111111111111111111111111111111', documentGeometry: { columns: 160, rows: 90 },
          reducedMotion: reduced, readOnly: true, instanceState: available ? 'window' : 'minimized',
          onWindowChange: value => api.changes.push(value), onInspectionCancel: viewer.close,
          renderInspection: viewer.placementId ? (_host, controls, scene) => h(Viewer, { scene, controlsContainer: controls, viewer }) : null,
        }, h(StageRef.current)));
      }
      root.render(h(App)); api.unmount = () => root.unmount();
    }, reducedMotion === 'reduce');
    await page.locator('[data-asset="one"]').waitFor();
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

test('inspection skips unrendered assets and closes cleanly from both modes', () => fixture(async page => {
  // Use the session action so the harness's stable Stage need not mirror state.
  await page.evaluate(() => hardening.viewer.open('one')); await settle(page);
  assert.equal(await page.evaluate(() => hardening.viewer.total), 2);
  await page.getByRole('button', { name: 'Next artwork', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-lift-source]'));
  assert.equal(await page.evaluate(() => hardening.viewer.placementId), 'two');
  await page.getByRole('button', { name: 'Next artwork', exact: true }).click(); await settle(page);
  assert.equal(await page.evaluate(() => hardening.viewer.placementId), 'one');
  assert.equal(await page.locator('[data-lift-source]').count(), 0);
  await page.locator('.system-workflow__inspection-hit-surface').click({ position: { x: 5, y: 5 } });
  await page.waitForFunction(() => !hardening.viewer.placementId);
  assert.equal(await page.locator('[data-inspection-context]').count(), 0);
  assert.equal(await page.locator('[data-inspection-phase]').count(), 0);
}));

test('animated lift survives resize and returns without hidden sources or leftover overlays', () => fixture(async page => {
  await page.evaluate(() => hardening.viewer.open('two'));
  await page.waitForFunction(() => document.querySelector('[data-lift-source]'));
  const stage = page.locator('.system-workflow__stage-viewport'); await stage.hover();
  await page.mouse.wheel(0, 120); await settle(page);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !hardening.viewer.placementId);
  assert.equal(await page.locator('[data-lift-source],.system-workflow__lift-artwork').count(), 0);
  assert.equal(await page.locator('[data-asset="two"]').evaluate(n => document.activeElement === n), true);
}, 1280, 'no-preference'));

test('closing before image decode cannot later hide the restored source', () => fixture(async page => {
  await page.evaluate(() => {
    hardening.decodes = [];
    HTMLImageElement.prototype.decode = () => new Promise(resolve => hardening.decodes.push(resolve));
    hardening.viewer.open('two');
  });
  await page.waitForFunction(() => hardening.decodes.length > 0);
  assert.equal(await page.locator('[data-lift-source]').count(), 0);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !hardening.viewer.placementId);
  await page.evaluate(() => hardening.decodes.forEach(resolve => resolve())); await settle(page);
  assert.equal(await page.locator('[data-lift-source],.system-workflow__lift-artwork').count(), 0);
}));

test('owner navigation drag cancels on pointer cancellation, blur and Grid changes', () => fixture(async page => {
  await page.evaluate(async () => {
    hardening.unmount();
    const React = (await import('/@id/react')).default;
    const { createRoot } = (await import('/@id/react-dom/client')).default;
    const useInteraction = (await import('/src/public/ownerSystemWorkflow/useOwnerSystemWorkflowPlacementInteraction.js')).default;
    const root = createRoot(document.getElementById('root'));
    function Harness() {
      const canvasRef = React.useRef(null);
      const [gridId, setGridId] = React.useState('a'); hardening.setGridId = setGridId;
      const interaction = useInteraction({ canvasRef, authoringDisabled: true,
        controller: { draft: { profileAddress: 'a' }, selectedGrid: { id: gridId, placements: [] }, selectedPlacementIds: [], replaceSelection: () => {} },
        canNavigateGrid: () => 'b', onNavigateGrid: () => {},
      });
      hardening.interaction = interaction;
      return React.createElement('div', { id: 'swipe-target', ref: canvasRef,
        style: { width: 500, height: 300 }, onPointerDown: e => interaction.beginCanvasSelection(e, { navigationOnly: true }) });
    }
    root.render(React.createElement(Harness));
  });
  await page.locator('#swipe-target').waitFor();
  for (const interruption of ['pointercancel', 'blur', 'grid']) {
    await page.mouse.move(200, 100); await page.mouse.down(); await page.mouse.move(100, 100);
    await page.waitForFunction(() => hardening.interaction.gridSwipe !== null);
    await page.evaluate(kind => {
      if (kind === 'grid') hardening.setGridId('next');
      else window.dispatchEvent(kind === 'blur' ? new Event('blur') : new PointerEvent('pointercancel', { pointerId: 1 }));
    }, interruption);
    await settle(page);
    assert.equal(await page.evaluate(() => hardening.interaction.gridSwipe), null);
    await page.mouse.up();
  }
}));

for (const width of [1280, 390]) test(`wheel, immersive exit, focus containment and interruption at ${width}px`, () => fixture(async page => {
  const stage = page.locator('.system-workflow__stage-viewport');
  const board = page.locator('.system-workflow__presentation-board');
  await stage.hover();
  const before = await board.boundingBox(); await page.mouse.wheel(0, 120); await settle(page);
  assert.ok((await board.boundingBox()).width < before.width - 2);
  for (let i = 0; i < 20 && !(await board.getAttribute('data-immersive')); i++) {
    await stage.hover(); await page.mouse.wheel(0, -120); await page.waitForTimeout(270);
  }
  assert.equal(await board.getAttribute('data-immersive'), 'true');
  const recorded = await page.evaluate(() => hardening.changes.length);
  const frame = await board.boundingBox(); assert.equal(frame.x, 0); assert.equal(frame.y, 0);
  assert.equal(frame.width, width); assert.equal(frame.height, 800);
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  assert.equal(await board.evaluate(n => n.contains(document.activeElement)), true);
  await page.screenshot({ path: `.browser-test-runtime/hardening-immersive-${width}.png` });
  assert.equal(await page.evaluate(() => hardening.changes.length), recorded);
  await page.keyboard.press('Escape'); await settle(page);
  assert.equal(await board.getAttribute('data-immersive'), null);
  await page.waitForTimeout(470); await stage.hover(); await page.mouse.wheel(0, -120); await settle(page);
  assert.equal(await board.getAttribute('data-immersive'), 'true');
  await page.evaluate(() => hardening.setAvailable(false)); await settle(page);
  assert.equal(await page.locator(':popover-open').count(), 0);
  await page.evaluate(() => hardening.setAvailable(true)); await settle(page);
  assert.equal(await board.getAttribute('data-immersive'), null);
}, width));
