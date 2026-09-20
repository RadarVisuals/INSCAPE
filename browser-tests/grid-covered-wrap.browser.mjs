import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5189';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';
test('covered owner and Visitor Grids retain artwork across fast boundaries', { timeout: 240000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  mkdirSync(output, { recursive: true });
  try {
    const preparation = await browser.newPage();
    const raster = Buffer.from(await preparation.evaluate(async source => {
      const image = new Image(); image.src = 'data:image/jpeg;base64,' + source; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = 4096; canvas.height = 2304;
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png').split(',')[1];
    }, readFileSync(new URL('./fixtures/grid-landscape.jpg', import.meta.url)).toString('base64')), 'base64');
    await preparation.close();
    for (const count of [2, 6]) for (const visitor of [false, true]) for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const cdp = await page.context().newCDPSession(page);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await page.route('**/motion-artwork.png', route => route.fulfill({ contentType: 'image/png', body: raster }));
      await page.route('https://raw.githubusercontent.com/RadarVisuals/INSCAPE/**', route => route.fulfill({ contentType: 'image/webp', path: `public/${new URL(route.request().url()).pathname.split('/public/')[1]}` }));
      await page.route(`${origin}/__motion__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
      await page.goto(`${origin}/__motion__`);
      await page.evaluate(async ({ visitor, count }) => {
        const refresh = (await import('/@react-refresh')).default;
        refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
        const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
        const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
        const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
        const { createDefaultWorkbenchPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
        const profile = `0x${'1'.repeat(40)}`, key = systemWorkflowDraftKey(profile);
        const storage = fixture.createOwnerSystemWorkflowReviewStorage();
        const draft = JSON.parse(storage.getItem(key));
        const assets = fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS.map(asset => ({ ...asset, width: 4096, height: 2304, imageWidth: 4096, imageHeight: 2304, imageUrl: 'https://motion.invalid/motion-artwork.png', originalImageUrl: 'https://motion.invalid/motion-artwork.png', thumbnailUrl: 'https://motion.invalid/motion-artwork.png', previewSrc: 'https://motion.invalid/motion-artwork.png', src: 'https://motion.invalid/motion-artwork.png' }));
        const base = draft.grids[0], retainedGrids = draft.grids.slice(1);
        draft.grids = Array.from({ length: count }, (_, gridIndex) => ({ ...base, id: `grid:motion-${gridIndex}`, title: `Motion ${gridIndex}`, visibility: 'PUBLIC',
          placements: Array.from({ length: 1 }, (_, index) => ({ ...base.placements[0], id: `motion-${gridIndex}-${index}`, stableAssetId: assets[0].id,
            column: 0, row: 0, columnSpan: 32, rowSpan: 18, layer: index, navigationOrder: index,
          })) }));
        draft.grids.push(...retainedGrids);
        draft.workbench = createDefaultWorkbenchPresentation(); draft.workbench.display.open = true;
        // Fractional authored sizes expose disagreement between CSS scene slots
        // and a camera that accumulates rounded clientWidth measurements.
        draft.workbench.display.window = { left: 20, top: 40, width: 1001.3, height: 563.23125 };
        localStorage.setItem(key, JSON.stringify(draft)); window.__motionSaved = localStorage.getItem(key); window.__motionKey = key;
        await import('/src/index.css');
        await import('/src/inscapeTokens.css');
        await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css');
        const Component = visitor ? (await import('/src/profileDocument/components/ProfileDocumentV9Visitor.jsx')).default
          : (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
        const props = visitor ? { document: (await import('/src/profileDocument/domain/profileDocumentV9Builder.js')).buildProfileDocumentV9({ systemWorkflowDraft: draft, profileAddress: profile, assetRecords: assets }) }
          : { profileAddress: profile, reviewStorage: localStorage, reviewAssets: assets, reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Motion measurement' } };
        createRoot(document.getElementById('root')).render(React.createElement(Component, props));
      }, { visitor, count });

      const stage = page.locator(visitor ? '.visitor-grid-world__viewport' : '[data-system-workflow-artboard]');
      await stage.waitFor();
      await page.waitForFunction(minimum => {
        const images = [...document.querySelectorAll('.system-workflow__grid-plane img, .visitor-grid-world__grid-plane img')];
        return images.length >= minimum && images.every(image => image.complete && image.naturalWidth > 0);
      }, Math.min(3, count));
      await page.waitForTimeout(300);
      await page.addStyleTag({content: '.system-workflow__canvas, .visitor-grid-world__viewport {background:#00ff00!important}'});
      const box = await stage.boundingBox();
      await page.evaluate(() => {
        window.movedPreparedGrids = [];
        window.preparedGridObserver = new MutationObserver(records => {
          for (const record of records) for (const node of record.removedNodes) {
            if (node.nodeType === 1 && node.isConnected && node.matches('.system-workflow__grid-plane, .visitor-grid-world__grid-plane')) {
              window.movedPreparedGrids.push(node.dataset.renderedGridId || node.querySelector('[data-grid-id]')?.dataset.gridId);
            }
          }
        });
        window.preparedGridObserver.observe(document.getElementById('root'), { childList: true, subtree: true });
        window.railCheck = { running: true, repositioned: [], sources: [] };
        const viewport = document.querySelector('.system-workflow__canvas, .visitor-grid-world__viewport').getBoundingClientRect();
        let previous = new Map();
        const sample = () => {
          const current = new Map();
          for (const node of document.querySelectorAll('.system-workflow__grid-plane, .visitor-grid-world__grid-plane')) {
            const bounds = node.getBoundingClientRect();
            if (bounds.right <= viewport.left || bounds.left >= viewport.right) continue;
            const id = node.dataset.renderedGridId || node.querySelector('[data-grid-id]')?.dataset.gridId;
            const before = previous.get(id);
            // In a two-Grid loop an outgoing surface can exit one edge and
            // reenter the opposite edge between samples. Only artwork retained
            // in an overlapping visible region must keep its physical slot.
            if (before && before.transform !== node.style.transform
              && Math.min(before.right, bounds.right, viewport.right) > Math.max(before.left, bounds.left, viewport.left))
              window.railCheck.repositioned.push(id);
            current.set(id, { transform: node.style.transform, left: bounds.left, right: bounds.right });
            if (node.className.includes('--current') && window.railCheck.sources.at(-1) !== id) window.railCheck.sources.push(id);
          }
          previous = current;
          if (window.railCheck.running) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      const frames=[];
      cdp.on('Page.screencastFrame',event=>{frames.push(event.data);void cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(() => {})});
      await cdp.send('Page.startScreencast',{format:'png',everyNthFrame:1});
      if(!visitor) await page.keyboard.down('Space');
      for(const direction of [-1,-1,-1,-1,1,1,1,1]) {
        await page.mouse.move(box.x+box.width*(direction<0?.85:.15),box.y+box.height*.6); await page.mouse.down();
        await page.mouse.move(box.x+box.width*(direction<0?.15:.85),box.y+box.height*.6,{steps:4});
        await page.mouse.up(); await page.waitForTimeout(400);
      }
      if(!visitor) await page.keyboard.up('Space');
      await page.waitForTimeout(700); await cdp.send('Page.stopScreencast');
      assert.deepEqual(await page.evaluate(() => {
        window.preparedGridObserver.disconnect(); return window.movedPreparedGrids;
      }), [], 'handoffs must not detach and reinsert already prepared Grid surfaces');
      const rail = await page.evaluate(() => { window.railCheck.running = false; return window.railCheck; });
      assert.ok(rail.sources.length > 2, 'exercise multiple real Grid boundaries');
      assert.deepEqual(rail.repositioned, [], 'visible artwork keeps its rail position across each handoff');
      const leaks=[];
      for(let index=0;index<frames.length;index++) {
        const count=await page.evaluate(async({data,box})=>{
          const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();
          const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
          const context=canvas.getContext('2d');context.drawImage(image,0,0);
          const pixels=context.getImageData(Math.max(0,Math.ceil(box.x+3)),Math.ceil(box.y+box.height*.6),Math.min(image.width-Math.ceil(box.x+3),Math.floor(box.width-6)),4).data;
          let exposed=0;for(let p=0;p<pixels.length;p+=4)if(pixels[p+1]>190&&pixels[p]<70&&pixels[p+2]<70)exposed++;
          return exposed;
        },{data:frames[index],box});
        if(count){leaks.push({index,count});if(leaks.length<4)writeFileSync(output+'/covered-leak-'+visitor+'-'+width+'-'+index+'.png',Buffer.from(frames[index],'base64'));}
      }
      console.log({count,visitor,width,frames:frames.length,leaks});
      assert.ok(frames.length > 20); assert.deepEqual(leaks, []);
      assert.ok(await page.locator('.system-workflow__grid-plane, .visitor-grid-world__grid-plane').count() <= 5, 'prepare a bounded neighborhood');
      // A stationary arrival must still align after many wraps in either
      // direction. Checking only gaps between neighboring planes misses drift
      // of the whole rail relative to the Display's fixed outer edge.
      for (const direction of [-1, 1]) {
        await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(50);
        await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.waitForTimeout(50);
        const start = { x: box.x + box.width * .5, y: box.y + box.height * .6 };
        if (!visitor) await page.keyboard.down('Space');
        await page.mouse.move(start.x, start.y); await page.mouse.down();
        for (const count of [1, 4, 12]) {
          await page.evaluate(({ start, direction, count }) => {
            const viewport = document.querySelector('.system-workflow__canvas, .visitor-grid-world__viewport');
            const scale = viewport.getBoundingClientRect().width / viewport.clientWidth;
            window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, bubbles: true,
              clientX: start.x + direction * (count * (viewport.clientWidth - 1) * scale + .1), clientY: start.y }));
          }, { start, direction, count });
          await page.waitForTimeout(100);
          const offset = await page.evaluate(() => {
            const viewport = document.querySelector('.system-workflow__canvas, .visitor-grid-world__viewport');
            const current = document.querySelector('.system-workflow__grid-plane--current, .visitor-grid-world__grid-plane--current');
            return current.getBoundingClientRect().left - viewport.getBoundingClientRect().left;
          });
          assert.ok(Math.abs(offset - direction * .1) < .03,
            `stationary edge drift after ${count} crossings in direction ${direction}: ${offset}px`);
        }
        await page.mouse.up(); if (!visitor) await page.keyboard.up('Space');
      }
      assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey) === window.__motionSaved), true);
      assert.deepEqual(errors,[]);
      await page.screenshot({ path: output + '/covered-wrap-' + visitor + '-' + width + '.png' });
      await page.close();
    }
  } finally {await browser.close();}
});
