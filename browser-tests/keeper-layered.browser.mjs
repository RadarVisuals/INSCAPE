import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { mountTextToolsFixture } from './fixtures/text-tools-fixture.mjs';

const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5180';
const source = 'https://keepers.inscape.test/prepared.svg';
const art = new URL('./fixtures/keeper-layered.svg', import.meta.url);
const launch = () => chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
const beforeImports = page => page.route(source, route => route.fulfill({ contentType: 'image/svg+xml', path: art.pathname.replace(/^\/(\w:)/, '$1') }));

async function mount(page, visitor = false) {
  await mountTextToolsFixture(page, origin, { visitor, beforeImports: () => beforeImports(page) });
}
async function seed(page) {
  await mount(page);
  await page.evaluate(async source => {
    const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    const { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS } = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const { resolveLibraryImageAsset } = await import('/src/library/resolveLibraryImageAsset.js');
    const asset = await resolveLibraryImageAsset({ ...OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0], selectedMedia: { url: source, width: 2048, height: 2048 } });
    const draft = window.savedDraft();
    draft.keeperDocks = [{ id: 'keeper:swimmer', name: 'Swimming Keeper', asset, faces: 'right', movement: 'swim', size: 384, visibility: 'PUBLIC' }];
    draft.workbench.keeperDocks = [{ id: 'keeper:swimmer', position: { left: 600, top: 280 } }];
    localStorage.setItem(systemWorkflowDraftKey(draft.profileAddress), JSON.stringify(draft));
  }, source);
  await page.reload(); await mount(page);
  await page.getByRole('button', { name: 'Close Text tools', exact: true }).click();
  await page.getByRole('button', { name: 'Release Keeper', exact: true }).waitFor();
}
const position = page => page.locator('.keeper-roamer').evaluate(node => {
  const m = new DOMMatrix(getComputedStyle(node).transform); return { x: m.m41, y: m.m42 };
});
const backgroundClick = (page, x, y) => page.mouse.click(x, y);

test('Right-button hold follows across windows, releases at the final point and preserves controls and draft state', { timeout: 90000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(12000);
    await seed(page);
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).click();
    const saved = await page.evaluate(() => window.savedDraft());
    await page.evaluate(() => {
      window.keeperMenus = [];
      addEventListener('contextmenu', event => queueMicrotask(() => window.keeperMenus.push({ prevented: event.defaultPrevented, tag: event.target.tagName })), true);
    });
    const arrives = (x, y) => page.waitForFunction(({ x, y }) => {
      const r = document.querySelector('.keeper-roamer').getBoundingClientRect();
      return Math.hypot(r.x - x, r.y - y) < 7;
    }, { x, y });
    await page.mouse.move(1100, 650); await page.mouse.down({ button: 'right' });
    await arrives(1100, 650);
    // Cross a Display window while retaining the hold that started on empty space.
    await page.mouse.move(1050, 300, { steps: 12 }); await arrives(1050, 300);
    await page.mouse.move(700, 650, { steps: 12 }); await arrives(700, 650);
    await page.mouse.up({ button: 'right' });
    await page.mouse.move(1250, 800); await page.waitForTimeout(300);
    const resting = await position(page);
    assert.ok(Math.abs(resting.x - 700) < 7, 'hover stops retargeting after release');
    assert.ok(await page.evaluate(() => window.keeperMenus.some(item => item.prevented)), 'native context menu is suppressed for the follow gesture');
    assert.deepEqual(await page.evaluate(() => window.savedDraft()), saved, 'following is never authored state');
    // A new right-click starting on a real control retains its normal context menu.
    await page.getByRole('button', { name: 'Reset Workbench position', exact: true }).click({ button: 'right' });
    assert.equal(await page.evaluate(() => window.keeperMenus.at(-1).prevented), false);
    await page.mouse.move(1200, 700); await page.waitForTimeout(200);
    assert.ok(Math.abs((await position(page)).x - 700) < 7);
    await page.keyboard.down('Shift'); await page.mouse.click(1200, 700, { button: 'right' }); await page.keyboard.up('Shift');
    assert.equal(await page.evaluate(() => window.keeperMenus.at(-1).prevented), false);
    // Escape ends the hold even if the physical right button is still depressed.
    await page.mouse.move(1000, 700); await page.mouse.down({ button: 'right' }); await arrives(1000, 700);
    await page.keyboard.press('Escape'); await page.mouse.move(500, 700); await page.waitForTimeout(200);
    assert.ok(Math.abs((await position(page)).x - 1000) < 7);
    await page.mouse.up({ button: 'right' });
    // Lost-button recovery: moving after an outside release cannot resurrect a hold.
    await page.mouse.move(1100, 650); await page.mouse.down({ button: 'right' }); await arrives(1100, 650);
    await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, pointerType: 'mouse', buttons: 0, clientX: 900, clientY: 700 })));
    await page.mouse.move(500, 700); await page.waitForTimeout(200);
    assert.ok(Math.abs((await position(page)).x - 1100) < 7);
    await page.mouse.up({ button: 'right' });
    await page.mouse.move(1000, 700); await page.mouse.down({ button: 'right' }); await arrives(1000, 700);
    await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, pointerType: 'mouse' })));
    await page.mouse.move(500, 700); await page.waitForTimeout(200);
    assert.ok(Math.abs((await position(page)).x - 1000) < 7, 'cancelled pointers stop following');
    await page.mouse.up({ button: 'right' });
    // The same behaviour is supplied by the published Visitor component.
    await mount(page, true);
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).click();
    await page.mouse.move(1100, 650); await page.mouse.down({ button: 'right' }); await arrives(1100, 650);
    await page.mouse.move(600, 700); await arrives(600, 700); await page.mouse.up({ button: 'right' });
    await page.mouse.move(1200, 800); await page.waitForTimeout(200);
    assert.ok(Math.abs((await position(page)).x - 600) < 7);
  } finally { await browser.close(); }
});

test('Right-button following cancels on lost focus and remains disabled for reduced motion', { timeout: 45000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await seed(page); await page.getByRole('button', { name: 'Release Keeper', exact: true }).click();
    await page.mouse.move(1100, 650); await page.mouse.down({ button: 'right' });
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForFunction(() => document.querySelector('.keeper-instance').dataset.keeperPhase === 'docked');
    await page.mouse.up({ button: 'right' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).click();
    const before = await position(page);
    await page.mouse.move(1100, 650); await page.mouse.down({ button: 'right' }); await page.mouse.move(500, 700); await page.mouse.up({ button: 'right' });
    await page.waitForTimeout(150);
    assert.deepEqual(await position(page), before);
    const reachedWindow = await page.evaluate(() => {
      let reached = false;
      const observe = () => { reached = true; };
      window.addEventListener('contextmenu', observe);
      const event = new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true });
      document.querySelector('main.system-workflow').dispatchEvent(event);
      // The host may provide its own menu, but the Keeper must not stop propagation.
      window.removeEventListener('contextmenu', observe);
      return reached;
    });
    assert.equal(reachedWindow, true);
  } finally { await browser.close(); }
});

test('Prepared SVG parser preserves cropped parts and refuses ambiguous or active image sources', { timeout: 30000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage(); await page.goto(origin);
    const report = await page.evaluate(async text => {
      const { parseKeeperRig } = await import('/src/keeper/keeperRig.js');
      const doc = () => new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
      const rig = parseKeeperRig(doc()), failures = [];
      const changes = [
        svg => svg.querySelector('#body').remove(),
        svg => svg.querySelector('#body').id = 'tentacle-1',
        svg => svg.querySelector('image').setAttribute('href', 'https://example.com/other.webp'),
        svg => svg.querySelector('image').setAttribute('href', 'data:image/svg+xml;base64,PHN2Zy8+'),
        svg => svg.querySelector('#keeper').setAttribute('transform', 'scale(2)'),
        svg => svg.querySelector('image').setAttribute('width', '99999'),
      ];
      for (const change of changes) { const svg = doc(); change(svg); try { parseKeeperRig(svg); failures.push(false); } catch { failures.push(true); } }
      return { ids: rig.parts.map(p => p.id), failures, bodyRatio: rig.parts.at(-1).width / rig.parts.at(-1).height };
    }, await readFile(art, 'utf8'));
    assert.equal(report.ids.length, 8); assert.equal(report.ids.at(-1), 'body');
    assert.deepEqual(report.failures, Array(6).fill(true));
    assert.ok(Math.abs(report.bodyRatio - 881 / 967) < .000001);
  } finally { await browser.close(); }
});

test('Prepared artwork visibly reverses its tentacle sequence with turn direction', { timeout: 30000 }, async () => {
  await mkdir('.browser-test-runtime', { recursive: true });
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 760 } });
    await page.route(`${origin}/__keeper_turns__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
    await page.goto(`${origin}/__keeper_turns__`);
    const report = await page.evaluate(async svgText => {
      const refresh = (await import('/@react-refresh')).default;
      refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
      const React = (await import('/@id/react')).default, { createRoot } = (await import('/@id/react-dom/client')).default;
      const { KeeperRigArtwork } = await import('/src/keeper/KeeperRigArtwork.jsx');
      const { parseKeeperRig } = await import('/src/keeper/keeperRig.js');
      const { KEEPER_SWIM_DEFAULTS } = await import('/src/keeper/keeperSwim.js');
      await import('/src/keeper/keeper.css');
      const rig = parseKeeperRig(new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement);
      const style = document.createElement('style');
      style.textContent = 'body{margin:0;background:#202322;color:#eee;font:14px sans-serif}#root{display:grid;grid-template-columns:repeat(4,1fr)}.turn-frame{position:relative;height:380px;--keeper-size:340px}.turn-frame p{position:absolute;top:12px;left:20px;margin:0}.turn-frame .keeper-rig{left:50%;top:53%}';
      document.head.append(style);
      const frames = [1, -1].flatMap(direction => [0, .15, .3, 1.2].map(seconds => ({ direction, seconds, ref: React.createRef() })));
      createRoot(document.getElementById('root')).render(React.createElement(React.Fragment, null,
        ...frames.map((frame, index) => React.createElement('div', { key: index, className: 'turn-frame' },
          React.createElement('p', null, `${frame.direction > 0 ? 'Clockwise / top first' : 'Counterclockwise / bottom first'} · ${frame.seconds.toFixed(2)} s`),
          React.createElement(KeeperRigArtwork, { rig, ref: frame.ref })))));
      while (!frames.every(frame => frame.ref.current)) await new Promise(requestAnimationFrame);
      await Promise.all([...document.images].map(img => img.decode()));
      for (const frame of frames) {
        const motion = { vx: 0, vy: 0, heading: frame.direction * Math.PI / 2 };
        const options = { swim: { ...KEEPER_SWIM_DEFAULTS, staggerSeconds: .08 } };
        frame.ref.current.paint(motion, 0, options);
        for (let tick = 0; tick < Math.round(frame.seconds * 60); tick++) frame.ref.current.paint(motion, 1 / 60, options);
      }
      return [...document.querySelectorAll('.turn-frame')].map(card => {
        const rotation = id => {
          const matrix = new DOMMatrix(getComputedStyle(card.querySelector(`[data-keeper-part="${id}"]`)).transform);
          return Math.atan2(matrix.b, matrix.a);
        };
        const box = card.getBoundingClientRect();
        return { head: rotation('body'), top: rotation('tentacle-1'), bottom: rotation('tentacle-7'),
          contained: [...card.querySelectorAll('img')].every(img => {
            const r = img.getBoundingClientRect(); return r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom;
          }) };
      });
    }, await readFile(art, 'utf8'));
    assert.ok(report[2].head > 1 && report[2].top > .4 && Math.abs(report[2].bottom) < .08);
    assert.ok(report[6].head < -1 && report[6].bottom < -.4 && Math.abs(report[6].top) < .08);
    assert.ok(report.every(frame => frame.contained));
    await page.screenshot({ path: '.browser-test-runtime/keeper-directional-turns.png' });
  } finally { await browser.close(); }
});

test('Layered Keeper swims without flipping, preserves controls and drafts, and works for visitors and narrow screens', { timeout: 120000 }, async () => {
  await mkdir('.browser-test-runtime', { recursive: true });
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.25 });
    page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await seed(page);
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).click();
    assert.equal(await page.locator('.keeper-rig__part').count(), 8);
    assert.equal(await page.locator('.keeper-roamer > img').count(), 0);
    assert.equal(await page.locator('.keeper-roamer').evaluate(n => getComputedStyle(n).pointerEvents), 'none');
    const saved = await page.evaluate(() => window.savedDraft());
    await backgroundClick(page, 1100, 600);
    await page.waitForFunction(() => { const r = document.querySelector('.keeper-roamer').getBoundingClientRect(); return Math.hypot(r.x - 1100, r.y - 600) < 8; });
    const before = await position(page);
    await page.mouse.move(200, 850); await page.waitForTimeout(200);
    const after = await position(page); assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < 8, 'hover cannot retarget swimming');
    await backgroundClick(page, 450, 650); await page.waitForTimeout(1700);
    const rotations = await page.locator('.keeper-rig__part').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).transform));
    assert.equal(new Set(rotations).size, 8);
    assert.ok(rotations.every(value => !value.startsWith('matrix3d')), 'parts rotate in the screen plane');
    await page.screenshot({ path: '.browser-test-runtime/keeper-layered-wide.png' });
    await page.waitForFunction(() => { const r = document.querySelector('.keeper-roamer').getBoundingClientRect(); return Math.hypot(r.x - 450, r.y - 650) < 8; });
    // Completed drags and clicks on functional surfaces must not choose a new destination.
    await page.mouse.move(1000, 800); await page.mouse.down(); await page.mouse.move(1040, 800, { steps: 5 }); await page.mouse.up();
    await page.evaluate(() => {
      const button = document.querySelector('.keeper-tools select');
      button?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 989, clientX: 1200, clientY: 800 }));
      button?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 989, clientX: 1200, clientY: 800 }));
    });
    await page.waitForTimeout(250);
    const still = await position(page); assert.ok(Math.hypot(still.x - 450, still.y - 650) < 8);
    assert.deepEqual(await page.evaluate(() => window.savedDraft()), saved);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => [...document.querySelectorAll('.keeper-rig__part img')].every(n => {
      const r = n.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
    }));
    await page.screenshot({ path: '.browser-test-runtime/keeper-layered-narrow.png' });
    assert.equal(await page.evaluate(() => window.savedDraft().keeperDocks[0].size), 384);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Return Keeper', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.keeper-instance').dataset.keeperPhase === 'docked');
    await page.getByRole('combobox', { name: 'Keeper movement', exact: true }).selectOption('flip');
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).click();
    assert.equal(await page.locator('.keeper-roamer > img').count(), 1);
    assert.equal(await page.locator('.keeper-rig').count(), 0);
    await page.getByRole('combobox', { name: 'Keeper movement', exact: true }).selectOption('swim');
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).waitFor();
    await page.reload(); await mount(page, true);
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.locator('.keeper-rig').waitFor();
    assert.equal(await page.locator('.keeper-tools').count(), 0);
    await page.screenshot({ path: '.browser-test-runtime/keeper-layered-visitor.png' });
    await backgroundClick(page, 850, 650);
    await page.waitForFunction(() => { const r = document.querySelector('.keeper-roamer').getBoundingClientRect(); return Math.hypot(r.x - 850, r.y - 650) < 8; });
    await page.getByRole('button', { name: 'Return Keeper', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('.keeper-instance').dataset.keeperPhase === 'docked');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Layered Keeper holds still for reduced motion and reports recoverable rig loading failures', { timeout: 60000 }, async () => {
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(15000); await seed(page);
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).click();
    await page.waitForTimeout(100);
    const before = await page.locator('.keeper-roamer').evaluate(n => n.outerHTML);
    await backgroundClick(page, 1000, 700); await page.mouse.move(100, 100); await page.waitForTimeout(200);
    assert.equal(await page.locator('.keeper-roamer').evaluate(n => n.outerHTML), before);
    await page.getByRole('button', { name: 'Return Keeper', exact: true }).click();
    assert.equal(await page.locator('.keeper-instance').getAttribute('data-keeper-phase'), 'docked');
    await page.route(source, route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" />' }));
    await page.getByRole('combobox', { name: 'Keeper movement', exact: true }).selectOption('flip');
    await page.getByRole('combobox', { name: 'Keeper movement', exact: true }).selectOption('swim');
    await page.getByRole('button', { name: 'Retry Keeper artwork', exact: true }).waitFor();
    await beforeImports(page);
    await page.getByRole('button', { name: 'Retry Keeper artwork', exact: true }).click();
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).waitFor();
  } finally { await browser.close(); }
});

test('Swim controls tune active flight, reject invalid/failed saves and survive reset, undo, mode changes and reload', { timeout: 90000 }, async () => {
  await mkdir('.browser-test-runtime', { recursive: true });
  const browser = await launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    let artworkRequests = 0; page.on('request', request => { if (request.url() === source) artworkRequests++; });
    await seed(page);
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).click();
    const field = name => page.getByRole('spinbutton', { name: `Keeper ${name}`, exact: true });
    assert.equal(await field('swim speed').inputValue(), '420');
    assert.equal(await field('gather time').inputValue(), '0.4');
    assert.equal(await field('spread time').inputValue(), '0.55');
    await page.evaluate(() => { window.originalKeeperRig = document.querySelector('.keeper-rig'); });
    const requests = artworkRequests;
    await field('swim speed').fill('650');
    assert.equal(await page.evaluate(() => window.savedDraft().keeperDocks[0].swim), undefined, 'typing is not a completed edit');
    await field('swim speed').press('Enter');
    for (const [name, value] of [['gather time', '.2'], ['spread time', '.3'], ['head turn time', '.25'], ['tentacle stagger', '.1']]) {
      await field(name).fill(value); await field(name).press('Enter');
    }
    const tuning = { speed: 650, gatherSeconds: .2, spreadSeconds: .3, turnSeconds: .25, staggerSeconds: .1 };
    assert.deepEqual(await page.evaluate(() => window.savedDraft().keeperDocks[0].swim), tuning);
    assert.equal(await page.locator('.keeper-instance').getAttribute('data-keeper-phase'), 'free');
    assert.ok(await page.evaluate(() => window.originalKeeperRig === document.querySelector('.keeper-rig')), 'tuning does not remount artwork');
    assert.equal(artworkRequests, requests, 'tuning does not reload the embedded images');
    await field('swim speed').fill('9000'); await field('swim speed').press('Enter');
    assert.equal(await field('swim speed').inputValue(), '650');
    await field('gather time').fill('1'); await field('gather time').press('Escape');
    assert.deepEqual(await page.evaluate(() => window.savedDraft().keeperDocks[0].swim), tuning);
    await page.evaluate(() => { window.failSave = true; });
    await field('swim speed').fill('600'); await field('swim speed').press('Enter');
    assert.equal(await field('swim speed').inputValue(), '650');
    assert.deepEqual(await page.evaluate(() => window.savedDraft().keeperDocks[0].swim), tuning);
    await page.getByRole('alert').filter({ hasText: 'not saved' }).waitFor();
    await page.evaluate(() => { window.failSave = false; });
    await page.getByRole('button', { name: 'Reset swim tuning', exact: true }).click();
    assert.equal(await field('swim speed').inputValue(), '420');
    await page.locator('main.system-workflow').focus(); await page.keyboard.press('Control+z');
    assert.deepEqual(await page.evaluate(() => window.savedDraft().keeperDocks[0].swim), tuning);
    await page.getByRole('status').filter({ hasText: 'Undid:' }).waitFor({ state: 'hidden' });
    await field('swim speed').scrollIntoViewIfNeeded();
    await page.screenshot({ path: '.browser-test-runtime/keeper-tuning-wide.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await field('tentacle stagger').scrollIntoViewIfNeeded();
    await page.screenshot({ path: '.browser-test-runtime/keeper-tuning-narrow.png' });
    for (const name of ['swim speed', 'gather time', 'spread time', 'head turn time', 'tentacle stagger']) {
      await field(name).scrollIntoViewIfNeeded();
      const box = await field(name).boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844, `${name} stays reachable`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('combobox', { name: 'Keeper movement', exact: true }).selectOption('flip');
    assert.equal(await page.locator('.keeper-swim-controls').count(), 0);
    await page.getByRole('combobox', { name: 'Keeper movement', exact: true }).selectOption('swim');
    assert.equal(await field('swim speed').inputValue(), '650');
    await page.reload(); await mount(page);
    const closeTextTools = page.getByRole('button', { name: 'Close Text tools', exact: true });
    if (await closeTextTools.count()) await closeTextTools.click();
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).click();
    assert.equal(await field('tentacle stagger').inputValue(), '0.1');
    assert.deepEqual(await page.evaluate(() => window.savedDraft().keeperDocks[0].swim), tuning);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
