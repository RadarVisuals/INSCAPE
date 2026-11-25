import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
const profile = '0x' + 'a'.repeat(40);
const rows = Array.from({length: 3000}, (_, i) => {
  const id = '0x' + (i + 1).toString(16).padStart(40, '0');
  return { id, profile_id: profile, balance: '1', asset_id: id, token_id: null,
    asset: { id, name: 'Artwork ' + String(i + 1).padStart(4, '0'), isLSP7: true,
      images: [{index: 0, width: 96, height: 96, url: 'https://art.test/' + i + '.png'}] } };
});
const count = n => ({aggregate:{count:n}});
test('cold workspace and deep source scroll on a synthetic 3000-asset profile', async () => {
  const browser = await chromium.launch({ executablePath: process.env.INSCAPE_BROWSER_EXECUTABLE });
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900}});
    const requests = [];
    let png, rejectSearch = false, releaseInventory;
    const gate = new Promise(resolve => {releaseInventory = resolve;});
    const searchCalls = [];
    let releaseSlow;
    const waitForRelease = new Promise(resolve => {releaseSlow = resolve;});
    function matches(row, filter) {
      return Object.entries(filter || {}).every(([key, value]) => {
        if (key === '_and') return value.every(child => matches(row,child));
        if (key === '_or') return value.some(child => matches(row,child));
        if (key === '_eq') return row === value;
        if (key === '_ilike') return String(row ?? '').toLowerCase().includes(value.slice(1,-1).toLowerCase());
        return matches(row?.[key],value);
      });
    }
    await page.route('**/*', async route => {
      const req = route.request();
      if (req.url().startsWith(origin)) return route.continue();
      if (req.url().includes('graphql') && req.method() === 'POST') {
        const {query, variables:v} = req.postDataJSON();
        const owned = query.includes('query InscapeEnvioProfileAssets');
        const created = query.includes('query ProfileCreations');
        requests.push(owned && !Object.keys(v.filter).length ? 'owned' : created ? 'created' : 'targeted');
        await gate;
        const filtered = v.filter?._and || v.assetFilter?._and;
        if (filtered) {
          searchCalls.push(owned ? 'owned' : 'created');
          if (JSON.stringify(filtered).includes('Artwork 1000')) await waitForRelease;
          if (rejectSearch) return route.fulfill({json:{errors:[{message:'Unsupported filter'}]}});
        }
        const holdings = owned ? rows.filter(row => matches(row,v.filter)) : [];
        const creation = {...rows[0], asset:{...rows[0].asset,name:'Creator original', lsp4Creators:[{profile_id:profile}]}};
        const creations = created && matches(creation,v.assetFilter) ? [creation] : [];
        const data = owned ? {Hold:holdings.slice(v.offset,v.offset+v.limit), Hold_aggregate:count(holdings.length)}
          : {AssetCreators:creations,TokenCreators:[],AssetCreators_aggregate:count(creations.length), TokenCreators_aggregate:count(0)};
        return route.fulfill({json:{data}});
      }
      if (req.resourceType() === 'image' && png) return route.fulfill({body:png,contentType:'image/png'});
      if (req.method() === 'POST') {
        const rpc = req.postDataJSON();
        const data = rpc.params?.[0]?.data || '';
        // Profile contract facts may request only the two register length slots.
        const lengthOnly = /^0x54f6127f[0-9a-f]{64}$/i.test(data)
          && (data.includes('6460ee3c') || data.includes('7c8c3416'));
        if (!['eth_chainId','eth_getCode'].includes(rpc.method)
          && !data.startsWith('0x01ffc9a7') && !lengthOnly) requests.push(rpc.method + ':' + data);
      }
      return route.abort();
    });
    const fixtureUrl = origin + '/browser-tests/workspace-idb-fixture.html';
    await page.goto(fixtureUrl);
    await page.evaluate(async () => {fixture.seed(); await fixture.start(); await fixture.grow();});
    png = Buffer.from(await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = c.height = 96;
      c.getContext('2d').fillRect(0,0,96,96); return c.toDataURL().split(',')[1];
    }), 'base64');
    requests.length = 0;
    await page.goto(origin + '/browser-tests/workbench-storage-fixture.html?profile=' + profile + '&shell&source-benchmark');
    await page.waitForFunction(() => window.savedDraft?.()?.activeId === 'workbench:second' && document.querySelector('.editor-menu-bar'));
    const workbenchMs = await page.evaluate(() => Math.round(performance.now()));
    await page.waitForTimeout(750);
    const boot = requests.splice(0);
    await page.goto(fixtureUrl);
    await page.evaluate(() => window.restoreLibraryDock());
    await page.goto(origin + '/browser-tests/workbench-storage-fixture.html?profile=' + profile + '&shell&source-benchmark');
    await page.locator('[data-library-asset-id]').first().waitFor();
    await page.waitForTimeout(350);
    assert.deepEqual(requests.splice(0), [], 'restored Studio Library dock');
    await page.goto(fixtureUrl);
    await page.evaluate(() => fixture.mount());
    const destination = page.locator('[data-curation-pane="destination"] [data-library-asset-id]');
    await destination.first().waitFor();
    const curationMs = await page.evaluate(() => Math.round(performance.now()));
    const curatedCard = destination.first().locator('button').first();
    await curatedCard.click();
    assert.equal(await curatedCard.getAttribute('aria-pressed'), 'true', 'curation works while inventory is pending');
    releaseInventory();
    const source = page.locator('[data-curation-pane="source"]');
    await source.locator('[data-library-asset-id]').first().waitFor();
    const opening = requests.slice();
    const input = source.getByRole('searchbox');
    const scope = source.getByLabel('Inventory relationship');
    await scope.selectOption('owned');
    const firstSearch = page.waitForRequest(request => request.postData()?.includes('Artwork 1000'));
    await input.fill('Artwork 1000');
    await firstSearch;
    await input.fill('Artwork 2999');
    await source.getByRole('button',{name:/Artwork 2999/}).waitFor();
    releaseSlow();
    await page.waitForTimeout(250);
    assert.equal(await source.getByRole('button',{name:/Artwork 1000/}).count(),0);
    assert.deepEqual(searchCalls,['owned','owned']);
    await source.getByRole('button',{name:/Artwork 2999/}).dblclick();
    await page.waitForFunction(() => fixture.library().workspace.curatedAssetIds.length === 761);
    await scope.selectOption('created');
    await source.getByText('Profile search / 0 matches loaded').waitFor();
    assert.equal(searchCalls.at(-1),'created');
    await input.fill('Creator original');
    await source.getByRole('button',{name:/Creator original/}).waitFor();
    await scope.selectOption('owned');
    rejectSearch = true;
    await input.fill('unavailable search');
    await source.getByText(/Search loaded items \/ 24 loaded/).waitFor();
    await source.getByRole('button',{name:'Load more',exact:true}).click();
    await source.getByText(/Search loaded items \/ 48 loaded/).waitFor();
    await input.fill('');
    await scope.selectOption('all');
    rejectSearch = false;
    await page.evaluate(list => window.populateBenchmarkInventory(list), rows);
    const scroll = source.locator('.lattice-browser-results');
    await page.waitForFunction(() => document.querySelector('[data-curation-pane="source"] .lattice-browser-results')?.scrollHeight > 20000);
    for (const fraction of [.25,.50,.75,.95]) {
      await scroll.evaluate((node,f) => {node.scrollTop = node.scrollHeight*f;},fraction);
      await page.waitForTimeout(150);
    }
    const metrics = await source.evaluate(el => {
      const images = new Map([...el.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth)
        .map(i => [i.currentSrc, i.naturalWidth*i.naturalHeight*4]));
      return {cards:el.querySelectorAll('[data-library-asset-id]').length,
        mountedDecodedSurfaceBytes:[...images.values()].reduce((a,b)=>a+b,0)};
    });
    const session = await browser.newBrowserCDPSession();
    const events = [];
    session.on('Tracing.dataCollected', ({value}) => events.push(...value));
    await session.send('Tracing.start', {traceConfig:{includedCategories:['disabled-by-default-memory-infra'],memoryDumpConfig:{allowedDumpModes:['detailed'],triggers:[]}}});
    await session.send('Tracing.requestMemoryDump',{levelOfDetail:'detailed'});
    const complete = new Promise(resolve => session.once('Tracing.tracingComplete',resolve));
    await session.send('Tracing.end'); await complete;
    // Memory dumps use hex byte counts. Use the latest observation per process
    // so an automatic and an explicit dump cannot count the same allocator twice.
    const compositor = new Map(), imageCache = new Map();
    for (const event of events) {
      const allocators = event.args?.dumps?.allocators;
      for (const [name, values] of [['cc/image_memory',compositor],['web_cache/Image_resources',imageCache]]) {
        const size = allocators?.[name]?.attrs?.size?.value;
        if (size !== undefined) values.set(event.pid,parseInt(size,16));
      }
    }
    const total = map => map.size ? [...map.values()].reduce((a,b) => a+b,0) : null;
    console.log(JSON.stringify({workbenchMs,curationMs,boot,opening,...metrics,
      compositorImageBytes:total(compositor), browserImageCacheBytes:total(imageCache)}));
    assert.deepEqual(boot,[]);
    assert.deepEqual([...opening].sort(),['created','owned']);
    assert.ok(metrics.cards > 0 && metrics.cards < 150);
  } finally {await browser.close();}
});

test('Studio places a saved folder image offline and retains its identity on reload', async () => {
  const browser = await chromium.launch({executablePath:process.env.INSCAPE_BROWSER_EXECUTABLE});
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1000}});
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/browser-tests/workspace-idb-fixture.html');
    const expected = await page.evaluate(async () => {
      fixture.seed({pendingRecovery:false}); await fixture.start(); fixture.nestedLibrary();
      await fixture.confirmWorkspaceSaved(fixture.profile);
      await window.restoreLibraryDock();
      return fixture.library().workspace.folders.at(-1).imageSelections[1];
    });
    const inventory = [];
    // Supply only the application shell from localhost across the offline reload.
    await context.route('**/*', async route => {
      const req = route.request();
      if (req.url().startsWith(origin + '/')) return route.fulfill({response:await route.fetch()});
      if (req.url().includes('graphql') || /6460ee3c|7c8c3416/.test(req.postData() || '')
        && !req.postData().includes('0x54f6127f')) inventory.push(req.url());
      return route.abort('internetdisconnected');
    });
    await context.setOffline(true);
    await page.goto(origin + '/browser-tests/workbench-storage-fixture.html?profile=' + profile + '&shell&source-benchmark');
    await page.getByRole('button',{name:'Props',exact:true}).first().click();
    await page.locator('[data-library-folder-tile]').filter({hasText:'Heads'}).click();
    const card = page.getByRole('button',{name:'Image 2 of Prop 1',exact:true});
    await card.scrollIntoViewIfNeeded();
    assert.equal(await card.getAttribute('aria-disabled'),'false');
    const {x,y} = await card.evaluate(node => {
      const r = node.getBoundingClientRect(), x = r.x+r.width/2;
      for(let y=Math.max(10,r.y+8); y<Math.min(innerHeight-10,r.bottom); y+=6)
        if(node.contains(document.elementFromPoint(x,y))) return {x,y};
      throw Error('Image card is covered');
    });
    await page.mouse.move(x,y); await page.mouse.down(); await page.mouse.move(x+18,y+18,{steps:4});
    const point = await page.evaluate(() => {
      const host = document.querySelector('main.system-workflow'), rect = host.getBoundingClientRect();
      const style = getComputedStyle(host.querySelector('.workbench-canvas-content'));
      const left = rect.left + parseFloat(style.getPropertyValue('--canvas-left'));
      const top = rect.top + parseFloat(style.getPropertyValue('--canvas-top'));
      const canvas = {left, top, right:left+parseFloat(style.getPropertyValue('--canvas-width')),bottom:top+parseFloat(style.getPropertyValue('--canvas-height'))};
      for (let y=Math.max(350,canvas.top+90);y<Math.min(innerHeight-60,canvas.bottom-90);y+=24)
        for (let x=Math.min(innerWidth-60,canvas.right-90);x>Math.max(50,canvas.left+90);x-=24)
          if (document.elementFromPoint(x,y)?.matches('.system-workflow,.system-workflow__workbench,.system-workflow__display-instance')) return {x,y};
      throw Error('No exposed canvas');
    });
    await page.mouse.move(point.x,point.y,{steps:12});
    await page.getByText('Release to place Image',{exact:true}).waitFor();
    await page.mouse.up();
    const saved = ({assetId,url}) => {
      const work = window.savedDraft?.();
      const draft = work?.workbenches.find(w => w.id === work.activeId)?.content;
      return draft?.imageModules?.some(module => {
        const image = module.artwork;
        return image?.asset.stableAssetId === assetId && image.asset.media.url === url;
      });
    };
    await page.waitForFunction(saved,expected,{timeout:8000});
    await page.reload();
    await page.waitForFunction(saved,expected);
    await page.getByRole('button',{name:'Open Curation',exact:true}).click();
    await page.getByText('Curation opened',{exact:true}).waitFor();
    assert.deepEqual(inventory,[]);
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});
