import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import test from 'node:test';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5178';
test('populated owner and Visitor scenes move without per-frame React commits', { timeout: 240000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  const measurements = [];
  try {
    for (const visitor of process.env.INSCAPE_MOTION_HEAVY ? [false] : [false, true]) for (const width of process.env.INSCAPE_MOTION_HEAVY ? [1440] : [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, ...(process.env.INSCAPE_MOTION_RECORD ? { recordVideo: { dir: '.browser-test-runtime/grid-handoff-video', size: { width, height: 1000 } } } : {}) });
      const cdp = await page.context().newCDPSession(page);
      if (process.env.INSCAPE_MOTION_CPU) await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.INSCAPE_MOTION_CPU) });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.route('**/motion-artwork.png', route => route.fulfill({ contentType: 'image/jpeg', path: 'browser-tests/fixtures/grid-landscape.jpg' }));
      await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', route => route.fulfill({ contentType: 'image/webp', path: `public/${new URL(route.request().url()).pathname.split('/public/')[1]}` }));
      await page.route(`${origin}/__motion__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
      await page.goto(`${origin}/__motion__`);
      await page.evaluate(async ({ visitor, heavy }) => {
        const refresh = (await import('/@react-refresh')).default;
        refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
        const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
        const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
        const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
        const { createDefaultWorkbenchPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
        const profile = `0x${'1'.repeat(40)}`, key = systemWorkflowDraftKey(profile);
        const storage = fixture.createOwnerSystemWorkflowReviewStorage();
        const draft = JSON.parse(storage.getItem(key));
        const assets = heavy ? fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS : fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS.map(asset => ({ ...asset, imageUrl: 'https://motion.invalid/motion-artwork.png', originalImageUrl: 'https://motion.invalid/motion-artwork.png', thumbnailUrl: 'https://motion.invalid/motion-artwork.png', previewSrc: 'https://motion.invalid/motion-artwork.png', src: 'https://motion.invalid/motion-artwork.png' }));
        const base = draft.grids[0], retainedGrids = draft.grids.slice(1);
        draft.grids = Array.from({ length: 4 }, (_, gridIndex) => ({ ...base, id: `grid:motion-${gridIndex}`, title: `Motion ${gridIndex}`, visibility: 'PUBLIC',
          placements: Array.from({ length: 24 }, (_, index) => ({ ...base.placements[0], id: `motion-${gridIndex}-${index}`, stableAssetId: assets[0].id,
            column: index % 6 * 5, row: Math.floor(index / 6) * 4, columnSpan: 6, rowSpan: 5, layer: index, navigationOrder: index,
          })) }));
        if (heavy) draft.grids.forEach((grid, index) => {
          grid.placements = grid.placements.slice(0, 5).map((placement, i) => ({ ...placement,
            stableAssetId: assets[i === 0 ? 6 : (i + index) % 6].id,
            column: i === 0 ? 0 : i * 5, row: i === 0 ? 0 : 3,
            columnSpan: i === 0 ? 32 : 10, rowSpan: i === 0 ? 18 : 13,
          }));
        });
        draft.grids.push(...retainedGrids);
        draft.workbench = createDefaultWorkbenchPresentation(); draft.workbench.display.open = true;
        draft.workbench.display.window = { left: 20, top: 40, width: 1000, height: 562.5 };
        localStorage.setItem(key, JSON.stringify(draft)); window.__motionSaved = localStorage.getItem(key); window.__motionKey = key;
        await import('/src/index.css');
        await import('/src/inscapeTokens.css');
        await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
        const Component = visitor ? (await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default
          : (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
        const props = visitor ? { document: (await import('/src/profileDocument/domain/profileDocumentV9Builder.js')).buildProfileDocumentV9({ systemWorkflowDraft: draft, profileAddress: profile, assetRecords: assets }) }
          : { profileAddress: profile, reviewStorage: localStorage, reviewAssets: assets, reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Motion measurement' } };
        window.__motionCommits = 0; window.__motionRenderMs = 0;
        createRoot(document.getElementById('root')).render(React.createElement(React.Profiler, { id: 'motion', onRender: (_id, _phase, duration) => { window.__motionCommits++; window.__motionRenderMs += duration; } }, React.createElement(Component, props)));
      }, { visitor, heavy: Boolean(process.env.INSCAPE_MOTION_HEAVY) });
      const stage = page.locator(visitor ? '.visitor-grid-world__viewport' : '[data-system-workflow-artboard]');
      const track = page.locator(visitor ? '.visitor-grid-world__grid-track' : '.system-workflow__grid-track');
      const offset = () => track.evaluate(node => new DOMMatrix(getComputedStyle(node).transform).m41
        + Number(node.dataset.railOrigin || 0) * (node.clientWidth - 1));
      const gridId = () => visitor ? stage.getAttribute('data-active-grid-id')
        : page.locator('.system-workflow__grid-plane--current').getAttribute('data-rendered-grid-id');
      const play = async () => {
        await page.locator('.system-workflow__presentation-board').dispatchEvent('contextmenu', { clientX: 80, clientY: 100 });
        await page.getByText('PLAY GRIDS', { exact: true }).click();
      };
      await stage.waitFor();
      assert.ok((await stage.boundingBox()).width > 200, 'measure a laid-out artwork Stage');
      await page.waitForTimeout(1800);
      await page.waitForFunction(expected => {
        const images = [...document.querySelectorAll('.system-workflow__grid-plane--current img, .visitor-grid-world__grid-plane--current img')];
        return images.length >= expected && images.every(image => image.complete && image.naturalWidth > 0);
      }, process.env.INSCAPE_MOTION_HEAVY ? 5 : 24);
      await play();
      await page.waitForTimeout(600);
      const trace = [];
      if (process.env.INSCAPE_MOTION_TRACE) {
        cdp.on('Tracing.dataCollected', event => trace.push(...event.value));
        await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' });
      }
      const result = await page.evaluate(() => new Promise(resolve => {
        window.__motionCommits = 0; window.__motionRenderMs = 0;
        const frames = []; let previous;
        const start = performance.now();
        function sample(time) {
          if (previous) frames.push(time - previous); previous = time;
          if (time - start < 1600) requestAnimationFrame(sample);
          else { frames.sort((a, b) => a - b); resolve({ commits: window.__motionCommits, renderMs: window.__motionRenderMs,
            p95FrameMs: frames[Math.floor(frames.length * .95)], maxFrameMs: frames.at(-1), frames: frames.length }); }
        }
        requestAnimationFrame(sample);
      }));
      measurements.push({ visitor, width, ...result });
      if (process.env.INSCAPE_MOTION_TRACE) {
        const done = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
        await cdp.send('Tracing.end'); await done;
        writeFileSync('.browser-test-runtime/grid-motion-trace.json', JSON.stringify({ traceEvents: trace }));
        const paints = trace.filter(event => event.name === 'Paint').length;
        console.log('Paint events', paints,
          'Paint ms', trace.filter(event => event.name === 'Paint').reduce((total, event) => total + (event.dur || 0), 0) / 1000);
        if (!process.env.INSCAPE_MOTION_BASELINE) assert.ok(paints < result.frames / 4,
          'continuous translation must reuse composited artwork rather than repainting it every frame');
      }
      console.log(JSON.stringify(measurements.at(-1)));
      if (!process.env.INSCAPE_MOTION_BASELINE) assert.ok(result.commits < 12, `steady motion should not render every frame: ${result.commits}`);
      assert.ok(await offset() < -10, `autoplay actually moves artwork: ${await track.evaluate(node => JSON.stringify({ style: node.style.cssText, width: node.clientWidth, transform: getComputedStyle(node).transform, hidden: document.hidden }))}`);
      await page.getByRole('button', { name: 'Pause Grids', exact: true }).focus(); await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Pause Grids', exact: true }).waitFor({ state: 'detached' });
      await page.waitForTimeout(30);
      const paused = await offset(); await page.waitForTimeout(180);
      assert.equal(await offset(), paused, 'Pause retains progress');
      await page.screenshot({ path: `.browser-test-runtime/grid-motion-${visitor ? 'visitor' : 'owner'}-${width}.png` });
      if (!process.env.INSCAPE_MOTION_BASELINE && !process.env.INSCAPE_MOTION_MEASURE_ONLY) {
        await stage.dispatchEvent('pointerdown', { button: 0, pointerId: 9, clientX: 20, clientY: 20 });
        await stage.dispatchEvent('pointercancel', { pointerId: 9 });
        await page.waitForTimeout(50);
        assert.equal(await offset(), paused, 'taking control retains the paused camera position');
        const box = await stage.boundingBox();
        const startDrag = async () => {
          if (!visitor) await page.keyboard.down('Space');
          await page.mouse.move(box.x + box.width * .8, box.y + box.height * .55); await page.mouse.down();
        };
        // Holding before release must stop exactly where the pointer stopped.
        await startDrag();
        await page.mouse.move(box.x + box.width * .68, box.y + box.height * .55, { steps: 8 });
        await page.waitForTimeout(160); const held = await offset();
        assert.ok(held < paused - box.width * .1, 'drag follows the pointer directly');
        await page.mouse.up(); if (!visitor) await page.keyboard.up('Space');
        await page.waitForTimeout(400); assert.equal(await offset(), held, 'no automatic alignment after a held release');
        // A fresh flick continues in its release direction; grabbing interrupts
        // it immediately, without jumping back to the selected Grid.
        await startDrag();
        await page.mouse.move(box.x + box.width * .65, box.y + box.height * .55, { steps: 4 });
        const released = await offset();
        await page.mouse.up(); if (!visitor) await page.keyboard.up('Space');
        await page.waitForTimeout(100);
        assert.ok(await offset() < released - 3, 'flick continues after release');
        await startDrag(); const grabbed = await offset();
        await page.waitForTimeout(200); assert.equal(await offset(), grabbed, 'grabbing stops momentum immediately');
        await page.mouse.up(); if (!visitor) await page.keyboard.up('Space');
        await page.waitForTimeout(200); assert.equal(await offset(), grabbed, 'stationary release has no residual momentum');
        // Crossing a whole Grid while still holding must preserve the gesture.
        const beforeCross = await gridId();
        await startDrag();
        const beforeRail = await track.evaluate(node => new DOMMatrix(getComputedStyle(node).transform).m41);
        await page.evaluate(({ x, y, distance }) => {
          window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: x - distance, clientY: y, bubbles: true }));
        }, { x: box.x + box.width * .8, y: box.y + box.height * .55, distance: box.width * 1.2 });
        assert.ok(await track.evaluate(node => new DOMMatrix(getComputedStyle(node).transform).m41) < beforeRail - box.width * 1.1,
          'the camera moves immediately without waiting for navigation rendering');
        await page.waitForFunction(({ visitor, beforeCross }) => {
          const stage = document.querySelector(visitor ? '.visitor-grid-world__viewport' : '.system-workflow__grid-plane--current');
          return (visitor ? stage?.dataset.activeGridId : stage?.dataset.renderedGridId) !== beforeCross;
        }, { visitor, beforeCross });
        assert.notEqual(await gridId(), beforeCross, 'continuous drag crosses a Grid boundary');
        const crossed = await offset();
        await page.evaluate(({ x, y, distance }) => {
          window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: x - distance, clientY: y, bubbles: true }));
        }, { x: box.x + box.width * .8, y: box.y + box.height * .55, distance: box.width * 1.25 });
        assert.ok(await offset() < crossed - box.width * .03, 'drag remains captured after crossing');
        await page.waitForTimeout(160); await page.mouse.up(); if (!visitor) await page.keyboard.up('Space');
        // Place the camera near a boundary, then cross it by momentum alone.
        await startDrag();
        const nearEdge = box.x + box.width * .8 - box.width * .8 - await offset();
        await page.mouse.move(nearEdge, box.y + box.height * .55, { steps: 4 });
        await page.waitForTimeout(160); await page.mouse.up(); if (!visitor) await page.keyboard.up('Space');
        await startDrag();
        await page.mouse.move(box.x + box.width * .65, box.y + box.height * .55, { steps: 3 });
        const releaseGrid = await gridId();
        await page.mouse.up(); if (!visitor) await page.keyboard.up('Space');
        await page.waitForTimeout(2200);
        assert.notEqual(await gridId(), releaseGrid, 'momentum crosses a Grid boundary without a new gesture');
        const resting = await offset();
        assert.ok(Math.abs(resting) > 2, 'momentum stops between Grids without snapping');
        await page.waitForTimeout(200); assert.equal(await offset(), resting, 'momentum comes fully to rest');
        await page.screenshot({ path: `.browser-test-runtime/grid-momentum-${visitor ? 'visitor' : 'owner'}-${width}.png` });
        if (visitor) await page.getByRole('button', { name: 'Next Grid', exact: true }).click();
        else { await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(50); await page.emulateMedia({ reducedMotion: 'no-preference' }); }
        assert.equal(await offset(), 0, 'explicit navigation or reduced motion restores a canonical Grid');
        if (process.env.INSCAPE_MOTION_MANUAL_ONLY) {
          assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey) === window.__motionSaved), true);
          assert.deepEqual(errors, []); await page.close(); continue;
        }
        if (width === 1440) {
          await play(); const startGrid = await gridId();
          await page.evaluate(() => {
            const track = document.querySelector('.system-workflow__grid-track, .visitor-grid-world__grid-track');
            const samples = [], jumps = []; let previous = new Map(), lastTime;
            window.__handoff = { samples, jumps, running: true };
            const sample = time => {
              const width = track.clientWidth, origin = track.parentElement.getBoundingClientRect().left;
              const current = new Map();
              for (const plane of track.children) {
                if (getComputedStyle(plane).visibility !== 'visible') continue;
                const id = plane.dataset.renderedGridId || plane.querySelector('[data-grid-id]')?.dataset.gridId;
                const x = (plane.getBoundingClientRect().left - origin) / width;
                if (x <= -1 || x >= 1) continue;
                current.set(id, x);
                const before = previous.get(id);
                if (before !== undefined && Math.abs(x - before) > (time - lastTime) / 12000 + .025)
                  jumps.push({ id, before, x, time, dt: time - lastTime });
              }
              samples.push({ time, positions: Object.fromEntries(current) }); previous = current; lastTime = time;
              if (window.__handoff.running) requestAnimationFrame(sample);
            };
            requestAnimationFrame(sample);
          });
          await page.waitForTimeout(12400); assert.notEqual(await gridId(), startGrid);
          assert.ok(await offset() < -5, 'next slide continues at the boundary');
          await page.waitForTimeout(36000); assert.equal(await gridId(), startGrid, 'four populated Grids wrap');
          const handoff = await page.evaluate(() => { window.__handoff.running = false; return window.__handoff; });
          writeFileSync(`.browser-test-runtime/grid-handoff-${visitor ? 'visitor' : 'owner'}.json`, JSON.stringify(handoff));
          assert.deepEqual(handoff.jumps, [], 'retained artwork must not jump at a Grid handoff');
          await page.getByRole('button', { name: 'Pause Grids', exact: true }).focus(); await page.keyboard.press('Enter');
        } else {
          await page.emulateMedia({ reducedMotion: 'reduce' }); await play(); const startGrid = await gridId();
          await page.waitForTimeout(12400); assert.notEqual(await gridId(), startGrid);
          assert.equal(await offset(), 0, 'reduced motion advances without sliding');
        }
      }
      assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey) === window.__motionSaved), true);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {
    writeFileSync(`.browser-test-runtime/grid-motion-${process.env.INSCAPE_MOTION_BASELINE ? 'before' : 'after'}.json`, JSON.stringify(measurements, null, 2));
    await browser.close();
  }
});
