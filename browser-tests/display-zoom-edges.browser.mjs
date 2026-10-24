import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';
import { mountGridMotionFixture } from './fixtures/grid-motion-fixture.mjs';
import fs from 'node:fs';
import path from 'node:path';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5194';
const output = process.env.INSCAPE_BROWSER_OUTPUT || '.browser-test-runtime';
fs.mkdirSync(output, { recursive: true });
test('neighboring Display grids stay clipped while holding after navigation at fractional zoom', { timeout: 180000 }, async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const visitor of [false, true]) for (const density of [1, 1.25, 2]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: density });
      await mountGridMotionFixture(page, { origin, visitor, heavy: true, displayWidth: 601.3, edgeReview: true });
      const board = page.locator('.system-workflow__presentation-board').first(); await board.waitFor();
      const saved = await page.evaluate(() => localStorage.getItem(window.__motionKey));
      if (!visitor) {
        await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
        for (const name of ['Close Workbench Layers', 'Close Transform', 'Close Color', 'Close Image', 'Close Shape', 'Close FX', 'Close Info']) {
          const close = page.getByRole('button', { name, exact: true });
          if (await close.count()) { await close.focus(); await close.press('Enter'); }
        }
      }
      const exposeStage = async () => {
        const stage = page.locator(visitor ? '.visitor-grid-world__viewport' : '[data-system-workflow-artboard]').first();
        const bounds = await stage.boundingBox(), dx = Math.max(0, 96-bounds.x), dy = Math.max(0,100-bounds.y);
        if(dx || dy){
          await page.locator('main.system-workflow').first().focus();
          assert.equal(await page.evaluate(()=>Boolean(document.elementFromPoint(800,700)?.closest('[data-system-workflow-overlay], .workspace-navigation'))),false,'Space-pan starts outside host controls');
          await page.mouse.move(800,700);await page.keyboard.down('Space');await page.mouse.down();
          await page.mouse.move(800+dx,700+dy,{steps:4});await page.mouse.up();await page.keyboard.up('Space');
          await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        }
        assert.equal(await page.evaluate(() => localStorage.getItem(window.__motionKey)),saved,'exposing the pixel area never changes authored geometry');
        const overlap = await stage.evaluate(node=>{
          const area=node.getBoundingClientRect();
          return [...document.querySelectorAll('.workspace-navigation, .workbench-tool-panel, .workbench-navigator')].filter(other=>{
            if(!other.getClientRects().length)return false; const r=other.getBoundingClientRect();
            return r.left<area.right&&r.right>area.left&&r.top<area.bottom&&r.bottom>area.top;
          }).map(node=>node.className);
        });
        assert.deepEqual(overlap,[],'pixel area contains no overlapping sidebar, tool panel or Navigator');
      };
      await exposeStage();
      if (!visitor) {
        await page.getByRole('button', { name: 'Lock Display Module composition', exact: true }).focus();
        await page.keyboard.press('Enter');
      }
      // Retain a nonzero rail slot: starting a new drag after navigation must
      // not reveal either offscreen neighbour at an exact Grid boundary.
      const initialStage = page.locator(visitor ? '.visitor-grid-world__viewport' : '[data-system-workflow-artboard]').first();
      const initialBounds = await initialStage.boundingBox();
      await page.mouse.move(initialBounds.x + initialBounds.width * .8, initialBounds.y + initialBounds.height / 2);
      await page.mouse.down();
      await page.mouse.move(initialBounds.x - initialBounds.width * .2, initialBounds.y + initialBounds.height / 2, { steps: 10 });
      await page.waitForTimeout(150); await page.mouse.up();
      await page.waitForTimeout(800);
      const diagnostic = await page.addStyleTag({ content: '[data-rail-slot] { background: #00ff00 !important; } [data-rail-slot] > * { visibility: hidden !important; } .system-workflow__grid-plane--current, .visitor-grid-world__grid-plane--current { background: #000 !important; }' });
      let previous = 1;
      for (const scale of [1, .97, .89, .81, .73, .67, .59, .53, .47, .41, .37, .31, .25]) {
        await board.dispatchEvent('wheel', { deltaY: -Math.log(scale / previous) / .003, ctrlKey: true, clientX: 0, clientY: 0, bubbles: true, cancelable: true }); previous = scale;
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await exposeStage();
        const stage = page.locator(visitor ? '.visitor-grid-world__viewport' : '[data-system-workflow-artboard]').first();
        const bounds = await stage.boundingBox();
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        await page.mouse.down();
        const png = await page.screenshot();
        const green = await page.evaluate(async ({ png, bounds, density }) => {
          const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
          const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
          let count = 0; const samples = [];
          for(let y=Math.ceil((bounds.y+3)*density);y<Math.floor((bounds.y+bounds.height-3)*density);y++) for(let x=Math.ceil(bounds.x*density);x<Math.floor((bounds.x+bounds.width)*density);x++) {
            const i=(y*image.width+x)*4;if(pixels[i+1]>pixels[i]+12 && pixels[i+1]>pixels[i+2]+12) { count++; if(samples.length<60)samples.push({x:x/density,y:y/density,rgb:[...pixels.slice(i,i+3)]}); }
          } return {count,samples};
        }, { png: png.toString('base64'), bounds, density });
        if (green.count) {
          const trace = await page.evaluate(samples => samples.map(sample => ({...sample,hit:document.elementFromPoint(sample.x,sample.y)?.outerHTML.slice(0,400)})), green.samples);
          fs.writeFileSync(path.join(output, 'pixel-origin.json'), JSON.stringify({visitor,density,scale,bounds,count:green.count,samples:trace},null,2));
          await page.screenshot({ path: path.join(output, 'display-grid-edge-leak.png') });
        }
        assert.equal(green.count, 0, `${visitor ? 'Visitor' : 'Owner'}, density ${density}, zoom ${scale}`);
        await page.mouse.up();
      }
      await diagnostic.evaluate(el => el.remove());
      await page.screenshot({ path: `.browser-test-runtime/display-empty-dark-${visitor}-${density}.png` });
      await page.close();
    }
  } finally { await browser.close(); }
});
