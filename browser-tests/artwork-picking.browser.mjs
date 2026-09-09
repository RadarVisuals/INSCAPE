import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5186';
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const solid = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><path fill="blue" d="M0 0H200V200H0Z"/></svg>';
const cutout = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><path fill="red" d="M0 0H100V100H0Z"/></svg>';
const uri = svg => `data:image/svg+xml,${encodeURIComponent(svg)}`;
async function fixture(run) {
  const browser = await chromium.launch({ executablePath: edge, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    page.setDefaultTimeout(10_000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route(`${origin}/__picking__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__picking__`);
    await page.evaluate(async ({ solid, cutout }) => {
      const { createArtworkPicker } = await import('/src/public/ownerSystemWorkflow/artworkPicking.js');
      const root = document.getElementById('root');
      root.style.cssText = 'position:absolute;left:30px;top:30px;width:200px;height:200px;overflow:hidden';
      const picker = window.picker = createArtworkPicker();
      window.hits = [];
      for (let i = 0; i < 5; i++) {
        const node = document.createElement('div'); node.className = 'system-workflow__placement'; node.id = 'layer-' + i;
        node.style.cssText = `position:absolute;inset:0;z-index:${i}`;
        const opening = document.createElement('span'); opening.style.cssText = 'position:absolute;inset:0;overflow:hidden';
        const image = document.createElement('img'); image.style.cssText = 'position:absolute;left:0;top:0;width:200px;height:200px;transform-origin:center;pointer-events:none';
        image.onload = () => picker.prepare(image); image.src = i ? cutout : solid;
        opening.append(image); node.append(opening); root.append(node);
        node.addEventListener('pointerdown', event => picker.pick(event, root));
        node.addEventListener('click', event => window.hits.push(picker.pick(event, root)?.id || null));
      }
    }, { solid: uri(solid), cutout: uri(cutout) });
    // Preparation is asynchronous; poll the actual behavior rather than a cache flag.
    await page.waitForFunction(() => picker.pick({ type: 'click', detail: 1, clientX: 180, clientY: 180 }, document.getElementById('root'))?.id === 'layer-0');
    await run(page);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
}

test('four transparent foreground layers pass through to the background; solid pixels retain the top layer', () => fixture(async page => {
  await page.mouse.click(180, 180);
  await page.mouse.click(60, 60);
  assert.deepEqual(await page.evaluate(() => hits), ['layer-0', 'layer-4']);
}));

test('Alt no longer overrides pixel picking and keyboard activation stays explicit', () => fixture(async page => {
  await page.keyboard.down('Alt');
  for (let i = 0; i < 4; i++) await page.mouse.click(60, 60);
  await page.keyboard.up('Alt');
  assert.deepEqual(await page.evaluate(() => hits), ['layer-4', 'layer-4', 'layer-4', 'layer-4']);
  assert.equal(await page.evaluate(() => picker.pick({ type: 'click', detail: 0, currentTarget: document.getElementById('layer-4') }, document.getElementById('root')).id), 'layer-4');
}));

test('rotated, mirrored and cropped images are sampled in their displayed coordinates', () => fixture(async page => {
  await page.evaluate(() => {
    for (let i = 1; i < 4; i++) document.getElementById('layer-' + i).remove();
    document.querySelector('#layer-4 img').style.transform = 'rotate(90deg)';
  });
  await page.mouse.click(60, 60); await page.mouse.click(180, 60);
  assert.deepEqual(await page.evaluate(() => hits.splice(0)), ['layer-0', 'layer-4']);
  await page.evaluate(() => document.querySelector('#layer-4 img').style.transform = 'scale(-1, 1)');
  await page.mouse.click(60, 60); await page.mouse.click(180, 60);
  assert.deepEqual(await page.evaluate(() => hits.splice(0)), ['layer-0', 'layer-4']);
  await page.evaluate(() => {
    const img = document.querySelector('#layer-4 img'); img.style.transform = 'none'; img.style.left = '-100px';
    img.style.width = '400px'; img.style.height = '400px';
  });
  await page.mouse.click(60, 60); await page.mouse.click(180, 60);
  assert.deepEqual(await page.evaluate(() => hits), ['layer-4', 'layer-0']);
}));

test('Stage scaling, letterbox space and authored backing participate in picking', () => fixture(async page => {
  await page.evaluate(() => {
    for (let i = 1; i < 4; i++) document.getElementById('layer-' + i).remove();
    const root = document.getElementById('root'); root.style.transformOrigin = '0 0'; root.style.transform = 'scale(2)';
    const img = document.querySelector('#layer-4 img'); img.style.height = '100px'; img.style.top = '50px';
  });
  await page.mouse.click(60, 60); await page.mouse.click(60, 150);
  assert.deepEqual(await page.evaluate(() => hits.splice(0)), ['layer-0', 'layer-4']);
  await page.evaluate(() => document.querySelector('#layer-4 span').style.backgroundColor = 'white');
  await page.mouse.click(60, 60);
  assert.deepEqual(await page.evaluate(() => hits), ['layer-4']);
}));

test('blocked pixel access keeps rectangular picking; disposal cancels pending work', async () => {
  await fixture(async page => {
  // Force the browser's tainted-canvas outcome; routed responses can otherwise
  // bypass CORS, while this Edge build denies second-port loopback requests.
  await page.evaluate(source => {
    CanvasRenderingContext2D.prototype.getImageData = () => { throw new DOMException('Tainted canvas', 'SecurityError'); };
    document.querySelector('#layer-4 img').src = source;
  }, uri(cutout.replace('red', 'orange')));
  await page.waitForFunction(() => document.querySelector('#layer-4 img').complete && document.querySelector('#layer-4 img').naturalWidth > 0);
  await page.mouse.click(180, 180);
  assert.deepEqual(await page.evaluate(() => hits.splice(0)), ['layer-4']);
  await page.keyboard.down('Alt'); await page.mouse.click(180, 180); await page.keyboard.up('Alt');
  assert.deepEqual(await page.evaluate(() => hits), ['layer-4']);
  assert.equal(await page.evaluate(() => { picker.dispose(); return picker.pick({ type: 'click', detail: 1, clientX: 60, clientY: 60 }, document.getElementById('root')); }), null);
  });
});

test('warmed picking reads masks without a canvas readback on clicks', () => fixture(async page => {
  const result = await page.evaluate(() => {
    const original = CanvasRenderingContext2D.prototype.getImageData;
    let reads = 0; CanvasRenderingContext2D.prototype.getImageData = function (...args) { reads++; return original.apply(this, args); };
    const times = [], root = document.getElementById('root');
    for (let i = 0; i < 300; i++) {
      const start = performance.now();
      picker.pick({ type: 'click', detail: 1, clientX: 180, clientY: 180 }, root);
      times.push(performance.now() - start);
    }
    CanvasRenderingContext2D.prototype.getImageData = original;
    times.sort((a, b) => a - b);
    return { reads, median: times[150], p95: times[285] };
  });
  assert.equal(result.reads, 0);
  console.log('Five-layer picking timings (ms):', result);
}));

test('owner selection and inspection follow visible pixels in the actual Display', async () => {
  const browser = await chromium.launch({ executablePath: edge, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10_000);
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(`${origin}/development/owner/system-workflow`);
    const first = page.getByRole('button', { name: /Select ABYSSAL STUDY/ }); await first.waitFor();
    await page.evaluate(({ solid, cutout }) => {
      const nodes = [...document.querySelectorAll('[data-system-workflow-placement-id]')];
      nodes.forEach((node, i) => {
        node.style.cssText = `position:absolute;left:50px;top:50px;width:200px;height:200px;z-index:${i}`;
        node.querySelectorAll('img').forEach(image => { image.src = i ? cutout : solid; image.style.cssText = 'position:absolute;inset:0;width:200px;height:200px;opacity:1;transform:none'; });
      });
    }, { solid: uri(solid), cutout: uri(cutout) });
    // Wait for masks while checking selection through real React event handlers.
    const box = await first.boundingBox();
    await page.mouse.click(box.x + 150, box.y + 150);
    await page.waitForFunction(() => [...document.querySelectorAll('[data-system-workflow-placement-id]')].some(node => node.getAttribute('aria-pressed') === 'true'));
    // Asset dimension reporting can rerender its style. Use the current plane
    // for a stable overlap and retain production handlers and selection state.
    await page.evaluate(() => [...document.querySelectorAll('[data-system-workflow-placement-id]')].forEach((node, i) => {
      node.style.cssText = `position:absolute;left:50px;top:50px;width:200px;height:200px;z-index:${i}`;
    }));
    const target = await page.locator('[data-system-workflow-placement-id]').first().boundingBox();
    await page.mouse.dblclick(target.x + 150, target.y + 150);
    await page.getByRole('group', { name: 'Artwork inspection', exact: true }).waitFor();
    assert.equal(await page.locator('[data-system-workflow-placement-id]').first().getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Escape');
  } finally { await browser.close(); }
});

for (const width of [1440, 390]) test(`visitor clicks through transparent foreground in the actual Display (${width}px)`, async () => {
  const browser = await chromium.launch({ executablePath: edge, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10_000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const request = route.request();
      if (new URL(request.url()).origin === origin) return route.continue();
      if (request.resourceType() === 'image') return route.fulfill({ contentType: 'image/svg+xml',
        headers: { 'Access-Control-Allow-Origin': '*' }, body: request.url().includes('space-Alpha') ? cutout : solid });
      return route.fulfill({ contentType: 'application/json', body: '{"data":{}}' });
    });
    await page.goto(`${origin}/browser-tests/fixture.html`);
    await page.waitForFunction(() => [...document.querySelectorAll('[data-placement-id]')].length === 2
      && [...document.querySelectorAll('[data-placement-id]')].every(node => node.dataset.mediaState === 'ready'));
    await page.evaluate(async () => {
      const { createArtworkPicker } = await import('/src/public/ownerSystemWorkflow/artworkPicking.js');
      window.probePicker = createArtworkPicker();
      const nodes = [...document.querySelectorAll('[data-placement-id]')];
      nodes.forEach((node, i) => {
        node.style.cssText = `position:absolute;left:10px;top:10px;width:140px;height:140px;z-index:${i}`;
        const opening = node.querySelector('.lattice-production-placement__opening');
        opening.style.cssText = 'position:absolute;inset:0;width:140px;height:140px;overflow:hidden;background:transparent';
        node.querySelector('img').style.cssText = 'position:absolute;inset:0;width:140px;height:140px;opacity:1;transform:none';
      });
    });
    await page.waitForFunction(() => {
      const back = document.querySelector('[data-placement-id]'), box = back.getBoundingClientRect();
      return probePicker.pick({ type: 'click', detail: 1, clientX: box.x + 110, clientY: box.y + 110 }, back.parentElement) === back;
    });
    const back = page.locator('[data-placement-id]').first(), box = await back.boundingBox();
    await page.mouse.click(box.x + 110, box.y + 110);
    await page.getByRole('group', { name: 'Artwork inspection', exact: true }).waitFor();
    assert.match(await page.getByRole('complementary', { name: 'Display Module instruments', exact: true }).innerText(), /Alpha Artwork 1 public fixture description/);
    assert.equal(await page.locator('[data-placement-id]').last().getAttribute('data-inspection-context'), 'foreground');
    await page.screenshot({ path: `.browser-test-runtime/transparent-picking-${width}.png` });
    await page.keyboard.press('Escape');
    await page.getByRole('group', { name: 'Artwork inspection', exact: true }).waitFor({ state: 'detached' });
    assert.equal(await back.evaluate(node => node === document.activeElement), true);
    assert.equal(await page.evaluate(() => window.__visitorStorageOps.filter(op => ['setItem', 'removeItem', 'clear'].includes(op.method)).length), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
