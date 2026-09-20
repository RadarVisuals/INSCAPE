import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5189';

test('Grid handoffs retain the moving camera and linked Text in both directions', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  try {
    // Owner navigation updates its session immediately; Visitor uses React state.
    // Both let the camera schedule the resulting view update.
    for (const synchronousNavigation of [true, false]) {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.route(`${origin}/__handoff__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
      await page.goto(`${origin}/__handoff__`);
      await page.evaluate(async synchronous => {
        const refresh = (await import('/@react-refresh')).default;
        refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
        const React = (await import('/@id/react')).default;
        const { createRoot } = (await import('/@id/react-dom/client')).default;
        const { default: useGridPlayback } = await import('/src/public/ownerSystemWorkflow/useGridPlayback.js');
        const { SceneNavigationProvider, useReportScene, useSceneNavigation, useSceneProgress } = await import('/src/text/SceneNavigation.jsx');
        window.handoffs = []; window.passages = []; window.synchronousHandoffs = [];
        function Camera() {
          const [gridState, setGrid] = React.useState('0');
          const selected = React.useRef('0');
          const grid = synchronous ? selected.current : gridState;
          const canvasRef = React.useRef(null), trackRef = React.useRef(null);
          const camera = useGridPlayback({ gridId: grid, scope: 'handoff', enabled: true, playing: false, reducedMotion: false,
            canvasRef, trackRef, onPause() {},
            adjacentGrid: (id, direction) => String((Number(id) + (direction === 'next' ? 1 : 3)) % 4),
            onAdvance(id) { selected.current = id; setGrid(id); return true; },
          });
          window.camera = camera;
          window.jumpToGrid = id => { selected.current = id; setGrid(id); };
          useReportScene('display:test', camera.swipe?.sourceGridId || grid, camera.swipe?.targetGridId, camera.swipe, true, ['0', '1', '2', '3']);
          window.readHandoff = () => ({ grid, source: camera.swipe?.sourceGridId, target: camera.swipe?.targetGridId,
              x: new DOMMatrix(getComputedStyle(trackRef.current).transform).m41,
              localX: new DOMMatrix(getComputedStyle(trackRef.current).transform).m41 + (camera.swipe?.sourceSlot || 0) * 1000 });
          React.useLayoutEffect(() => {
            window.handoffs.push(window.readHandoff());
            if (window.movingCamera) window.synchronousHandoffs.push(window.readHandoff());
          });
          return React.createElement('div', { ref: canvasRef, style: { width: 1001, height: 500 } }, React.createElement('div', { ref: trackRef }));
        }
        function LinkedText() {
          const scene = useSceneNavigation()['display:test'], trackRef = React.useRef(null);
          useSceneProgress(scene, trackRef, true);
          window.readPassage = () => ({ grid: scene?.gridId, target: scene?.targetGridId, progress: scene?.motion?.progress });
          React.useLayoutEffect(() => { window.passages.push(window.readPassage()); });
          return React.createElement('div', null, React.createElement('div', { ref: trackRef }));
        }
        createRoot(document.getElementById('root')).render(React.createElement(SceneNavigationProvider, null,
          React.createElement(Camera), React.createElement(LinkedText)));
      }, synchronousNavigation);
      await page.waitForFunction(() => window.camera);
      await page.waitForTimeout(50);
      await page.evaluate(() => window.camera.beginDrag(0));
      // Hold across whole Grids, wrap last-to-first, reverse, then wrap back.
      for (const [x, grid, target, residual] of [
        [-900, '0', '1', -900], [-1000, '1', '2', 0], [-1100, '1', '2', -100], [-2100, '2', '3', -100],
        [-3100, '3', '0', -100], [-4100, '0', '1', -100], [-3900, '0', '3', 100],
        [-2900, '3', '2', 100], [-1900, '2', '1', 100], [-900, '1', '0', 100], [100, '0', '3', 100],
      ]) {
        const observations = await page.evaluate(x => new Promise(resolve => requestAnimationFrame(() => {
          window.handoffs = []; window.passages = [];
          window.movingCamera = true;
          window.camera.moveDrag(x);
          window.movingCamera = false;
          requestAnimationFrame(() => resolve({ handoffs: [...window.handoffs, window.readHandoff()], passages: [...window.passages, window.readPassage()] }));
        })), x);
        assert.ok(observations.handoffs.length > 0);
        for (const handoff of observations.handoffs) {
          assert.equal(handoff.grid, grid);
          assert.equal(handoff.source, grid, 'the moving source must survive navigation');
          assert.equal(handoff.target, target, 'the incoming scene must never disappear at a handoff');
          assert.ok(Math.abs(handoff.x - x) < .001, 'the visual rail never rebases at a Grid boundary');
          assert.ok(Math.abs(handoff.localX - residual) < .001, 'navigation retains Grid-local progress');
        }
        assert.ok(observations.passages.length > 0);
        for (const passage of observations.passages) {
          assert.equal(passage.grid, grid);
          assert.equal(passage.target, target, 'linked Text keeps its incoming passage');
          assert.ok(Math.abs(passage.progress * 1001 - residual) < .001, 'linked Text retains Display progress');
        }
      }
      assert.deepEqual(await page.evaluate(() => window.synchronousHandoffs), [],
        'ordinary crossings must not force React commits inside the camera movement');
      await page.evaluate(() => window.camera.moveDrag(-1000));
      await page.waitForTimeout(30);
      assert.equal(await page.evaluate(() => window.readHandoff().x), -1000, 'exact arrival retains the rail while held');
      await page.evaluate(() => window.camera.endDrag(true));
      await page.waitForTimeout(30);
      assert.equal(await page.evaluate(() => window.readHandoff().x), 0, 'a canonical stop clears both the local and physical offsets');
      const startGrid = await page.evaluate(() => window.readHandoff().grid);
      await page.evaluate(() => {
        window.camera.beginDrag(0);
        // Reverse and cross again before React has committed any intermediate
        // state; the long jump also exercises synchronous neighborhood catch-up.
        for (const x of [-1100, -900, -2100, -1900, -3100, -6100, 100]) window.camera.moveDrag(x);
      });
      await page.waitForTimeout(50);
      const latest = await page.evaluate(() => ({ camera: window.readHandoff(), text: window.readPassage() }));
      assert.equal(latest.camera.grid, startGrid);
      assert.equal(latest.camera.source, startGrid);
      assert.ok(Math.abs(latest.camera.x - 100) < .001, 'late commits cannot reset a newer camera movement');
      assert.equal(latest.text.grid, startGrid);
      assert.ok(Math.abs(latest.text.progress * 1001 - 100) < .001);
      await page.evaluate(() => {
        window.camera.moveDrag(-1100);
        window.jumpToGrid('3');
      });
      await page.waitForTimeout(50);
      assert.equal(await page.evaluate(() => window.readHandoff().grid), '3');
      assert.equal(await page.evaluate(() => window.readHandoff().x), 0,
        'explicit navigation supersedes a pending camera crossing');
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
