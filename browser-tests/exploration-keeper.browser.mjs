import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
const origin = process.env.INSCAPE_TEXT_ROOT || 'http://127.0.0.1:5217';
const address = '0x' + '1'.repeat(40), source = 'https://keeper-room.invalid/keeper-layered.svg';
const url = `${origin}/browser-tests/profile-overview-fixture.html?view=${address}&reception=1&owner=1`;
async function mount(context, owner = true) {
  const page = await context.newPage(); page.setDefaultTimeout(15000);
  await page.route('**/*', route => route.request().url() === source
    ? route.fulfill({ contentType: 'image/svg+xml', path: 'browser-tests/fixtures/keeper-layered.svg' })
    : new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(owner ? url : url.replace('&owner=1', ''));
  await page.getByRole('region', { name: 'Reception layout' }).waitFor();
  return page;
}
async function seed(page) {
  await page.evaluate(async ({ address, source }) => {
    const { systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    localStorage.setItem(systemWorkflowDraftKey(address), JSON.stringify(window.__overviewDraft));
    const { useLibraryStore } = await import('/src/library/state/useLibraryStore.js');
    const { createEmptyWorkspace } = await import('/src/library/domain/libraryWorkspace.js');
    const record = { id: `42:0x${'3'.repeat(40)}:0x01`, chainId: 42, contractAddress: '0x' + '3'.repeat(40), tokenId: '0x01', ownerAddress: address, standard: 'LSP8', name: 'Room swimmer', collectionName: 'Room studies',
      imageUrl: source, thumbnailUrl: source, originalImageUrl: source, imageWidth: 2048, imageHeight: 2048, creators: [], attributes: [] };
    useLibraryStore.getState().setProfileAddress(address);
    useLibraryStore.setState({ profileAddress: address, workspace: createEmptyWorkspace(address), assets: [record], status: 'ready', error: null, liveError: null, persistenceError: null });
  }, { address, source });
}
const draft = page => page.evaluate(address => JSON.parse(localStorage.getItem('inscape.system-workflow-draft.v1:' + address)), address);

test('room reuses Keeper Library drop, live swim speed, flight, recall and saved settings without duplication', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  let page;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    page = await mount(context); const errors = []; page.on('pageerror', error => errors.push(error.message));
    await seed(page); const original = await draft(page);
    await page.getByRole('button', { name: /^Explore/ }).click();
    await page.locator('.keeper-dock').waitFor();
    await page.locator('.exploration-environment > img').first().evaluate(image => image.decode());
    assert.equal((await draft(page)).keeperDocks.length, 1);
    await page.getByRole('button', { name: 'Library', exact: true }).click();
    const card = page.getByRole('region', { name: 'Library workspace' }).getByRole('button', { name: /Room swimmer.*Room studies/i });
    await card.waitFor();
    const from = await card.boundingBox(), to = await page.locator('.keeper-dock').boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + 35); await page.mouse.down();
    for (let step = 1; step <= 14; step++) {
      await page.mouse.move(from.x + from.width / 2 + (to.x + to.width / 2 - from.x - from.width / 2) * step / 14,
        from.y + 35 + (to.y + to.height / 2 - from.y - 35) * step / 14);
      await page.waitForTimeout(20);
    }
    await page.mouse.up();
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close workspace', exact: true }).click();
    await page.getByRole('button', { name: 'Keeper settings', exact: true }).click();
    await page.getByLabel('Keeper swim speed', { exact: true }).fill('180');
    await page.getByLabel('Keeper swim speed', { exact: true }).press('Enter');
    assert.equal((await draft(page)).keeperDocks[0].swim.speed, 180);
    await page.getByRole('button', { name: 'Close Keeper settings', exact: true }).click();
    const saved = await draft(page);
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).click();
    const room = await page.locator('.exploration-room__canvas').boundingBox();
    const world = page.locator('.exploration-world');
    const actor = page.locator('.keeper-roamer');
    assert.equal(await page.locator('.keeper-dock-preview [data-keeper-rig]').count(), 1);
    const camera = await world.evaluate(node => ({ x: Number(node.dataset.cameraX), y: Number(node.dataset.cameraY) }));
    // Click a destination behind the first vertical metal beam. Its right face
    // is x=750; only the compact body footprint is stopped, not the tentacles.
    await page.mouse.click(room.x + 650 - camera.x, room.y + 1100 - camera.y);
    await page.waitForTimeout(2600);
    const stopped = await actor.evaluate(node => Number(node.dataset.worldX));
    assert.ok(stopped >= 765 && stopped < 780, 'vertical metal beam stops the compact core near its face');
    await page.getByRole('button', { name: 'Overview · 50% (F)', exact: true }).focus();
    await page.keyboard.press('f');
    await page.waitForFunction(() => document.querySelector('.exploration-world').dataset.zoom === '0.5');
    const wallFocus = await actor.evaluate(node => new DOMMatrix(node.style.transform).m41);
    assert.ok(Math.abs(wallFocus - room.x - room.width / 2) < 1, 'focus stays centred at the wall on 50%');
    await page.keyboard.press('f');
    await page.waitForFunction(() => document.querySelector('.exploration-world').dataset.zoom === '1');
    await mkdir('.browser-test-runtime/exploration-keeper', { recursive: true });
    await page.screenshot({ path: '.browser-test-runtime/exploration-keeper/wall-stopped.png' });
    const before = await world.evaluate(node => Number(node.dataset.cameraX));
    await page.mouse.move(room.x + room.width - 150, room.y + room.height / 2);
    await page.mouse.down({ button: 'right' });
    await page.waitForFunction(() => Number(document.querySelector('.keeper-roamer').dataset.worldX) > 1400);
    await page.getByRole('button', { name: 'Overview · 50% (F)', exact: true }).focus();
    await page.keyboard.press('f');
    await page.waitForFunction(() => document.querySelector('.exploration-world').dataset.zoom === '0.5');
    await page.keyboard.press('f');
    await page.waitForFunction(() => document.querySelector('.exploration-world').dataset.zoom === '1');
    await page.mouse.up({ button: 'right' });
    assert.ok(await world.evaluate(node => Number(node.dataset.cameraX)) > before + 400, 'camera follows through the larger room');
    const box = await actor.evaluate(node => { const m = new DOMMatrix(node.style.transform); return { x: m.m41, y: m.m42 }; });
    assert.ok(box.x > room.x && box.x < room.x + room.width && box.y > room.y && box.y < room.y + room.height);
    const currentCamera = await world.evaluate(node => ({ x: Number(node.dataset.cameraX), y: Number(node.dataset.cameraY) }));
    await page.mouse.click(room.x + 1850 - currentCamera.x, room.y + 950 - currentCamera.y);
    await page.waitForFunction(() => Math.hypot(Number(document.querySelector('.keeper-roamer').dataset.worldX) - 1850, Number(document.querySelector('.keeper-roamer').dataset.worldY) - 950) < 8);
    assert.deepEqual(await draft(page), saved, 'flight does not write authored content');
    await page.getByRole('button', { name: 'Overview · 50% (F)', exact: true }).focus();
    const sizeBefore = await actor.evaluate(node => parseFloat(node.style.getPropertyValue('--keeper-size')));
    await page.keyboard.press('f');
    await page.getByRole('button', { name: 'Normal · 100% (F)', exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('.exploration-world').dataset.zoom === '0.5');
    assert.equal(await actor.evaluate(node => parseFloat(node.style.getPropertyValue('--keeper-size'))), sizeBefore / 2);
    await page.screenshot({ path: '.browser-test-runtime/exploration-keeper/overview-50.png' });
    await page.keyboard.press('f');
    await page.getByRole('button', { name: 'Overview · 50% (F)', exact: true }).waitFor();
    await page.waitForFunction(() => document.querySelector('.exploration-world').dataset.zoom === '1');
    assert.deepEqual(await draft(page), saved, 'zoom is temporary presentation');
    await page.getByRole('button', { name: 'Keeper settings', exact: true }).click();
    await page.getByLabel('Keeper swim speed', { exact: true }).focus();
    await page.keyboard.press('f');
    assert.equal(await world.getAttribute('data-zoom'), '1', 'typing in controls does not zoom');
    await page.getByRole('button', { name: 'Close Keeper settings', exact: true }).click();
    await mkdir('.browser-test-runtime/exploration-keeper', { recursive: true });
    await page.screenshot({ path: '.browser-test-runtime/exploration-keeper/flying-1440.png' });
    await page.getByRole('button', { name: 'Return Keeper', exact: true }).click();
    await page.locator('[data-keeper-phase="docked"]').waitFor({ state: 'attached' });
    await page.getByRole('button', { name: 'Back to Reception', exact: true }).click();
    assert.equal(await page.locator('.keeper-roamer, .keeper-dock').count(), 0);
    await page.getByRole('button', { name: /^Explore/ }).click();
    await page.getByRole('button', { name: 'Release Keeper', exact: true }).waitFor();
    assert.equal((await draft(page)).keeperDocks.length, 1);
    assert.equal((await draft(page)).keeperDocks[0].swim.speed, 180);
    assert.deepEqual((await draft(page)).imageModules, original.imageModules);
    for (const width of [640, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole('button', { name: 'Back to Reception', exact: true }).click();
      await page.getByRole('button', { name: /^Explore/ }).click();
      const settings = page.getByRole('button', { name: 'Keeper settings', exact: true });
      await settings.waitFor();
      const box = await settings.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= width, 'Keeper controls remain in the narrow room');
      await settings.click();
      await page.getByLabel('Keeper swim speed', { exact: true }).waitFor();
      await page.screenshot({ path: `.browser-test-runtime/exploration-keeper/settings-${width}.png` });
      await page.getByRole('button', { name: 'Close Keeper settings', exact: true }).click();
      assert.equal((await draft(page)).keeperDocks.length, 1);
    }
    assert.deepEqual(errors, []);
  } catch (error) {
    await mkdir('.browser-test-runtime/exploration-keeper', { recursive: true });
    await page?.screenshot({ path: '.browser-test-runtime/exploration-keeper/failure.png' });
    console.log(await page?.locator('body').innerText());
    throw error;
  } finally { await browser.close(); }
});

test('visitor has no private Keeper editor and a second owner tab respects the editor lock', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const owner = await mount(context); await seed(owner);
    const visitor = await mount(context, false); const before = await draft(visitor);
    await visitor.getByRole('button', { name: /^Explore/ }).click();
    assert.equal(await visitor.locator('.keeper-dock').count(), 0);
    assert.equal(await visitor.getByRole('button', { name: 'Library', exact: true }).count(), 0);
    assert.deepEqual(await draft(visitor), before);
    await owner.getByRole('button', { name: /^Explore/ }).click(); await owner.locator('.keeper-dock').waitFor();
    const other = await mount(context); await other.getByRole('button', { name: /^Explore/ }).click();
    await other.getByText('This tab is view-only', { exact: true }).waitFor();
    assert.equal(await other.locator('.keeper-dock').count(), 0);
    await owner.getByRole('button', { name: 'Back to Reception', exact: true }).click();
    await other.getByRole('button', { name: 'Try editing here', exact: true }).click();
    await other.locator('.keeper-dock').waitFor();
    assert.equal((await draft(other)).keeperDocks.length, 1);
  } finally { await browser.close(); }
});

test('the exploration trial and two named Workbenches retain one shared Keeper', { timeout: 60000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const page = await mount(context), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await seed(page);
    await page.evaluate(async address => {
      const { createSystemWorkflowDraftStore } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
      const { addKeeperDock } = await import('/src/keeper/keeperSession.js');
      const store = createSystemWorkflowDraftStore({ profileAddress: address, storage: localStorage });
      store.renameWorkbench('Lunar Desert');
      addKeeperDock(store, address, { movement: 'swim' });
      store.createWorkbench('Studies');
    }, address);
    const original = await draft(page);
    await page.getByRole('button', { name: /^Explore/ }).click();
    await page.locator('.keeper-dock').waitFor();
    await page.getByRole('button', { name: 'Keeper settings', exact: true }).click();
    await page.getByLabel('Keeper swim speed', { exact: true }).fill('210');
    await page.getByLabel('Keeper swim speed', { exact: true }).press('Enter');
    const saved = await draft(page);
    assert.equal(saved.shared.keeperDocks.length, 1);
    assert.equal(saved.shared.keeperDocks[0].swim.speed, 210);
    assert.deepEqual(saved.workbenches, original.workbenches, 'room settings do not change either composition');
    await page.getByRole('button', { name: 'Close Keeper settings', exact: true }).click();
    await page.getByRole('button', { name: 'Back to Reception', exact: true }).click();
    await page.goto(`${origin}/browser-tests/workbench-storage-fixture.html`);
    const selector = page.getByRole('combobox', { name: 'Active Workbench' });
    await selector.waitFor();
    assert.equal(await selector.inputValue(), saved.activeId);
    for (const item of [saved.workbenches[0], saved.workbenches[1]]) {
      await selector.selectOption(item.id);
      await page.getByRole('button', { name: 'Keeper settings', exact: true }).click();
      assert.equal(await page.getByLabel('Keeper swim speed', { exact: true }).inputValue(), '210');
      await page.getByRole('button', { name: 'Close Keeper settings', exact: true }).click();
      const current = await draft(page);
      assert.equal(current.shared.keeperDocks.length, 1);
      assert.equal(current.shared.keeperDocks[0].id, saved.shared.keeperDocks[0].id);
      assert.ok(current.workbenches.every(workbench => !Object.hasOwn(workbench.content, 'keeperDocks')));
    }
    await page.reload(); await selector.waitFor();
    assert.equal((await draft(page)).shared.keeperDocks[0].swim.speed, 210);
    await page.setViewportSize({ width: 390, height: 900 });
    await page.getByRole('button', { name: 'Keeper settings', exact: true }).click();
    assert.equal(await page.getByLabel('Keeper swim speed', { exact: true }).inputValue(), '210');
    await page.getByRole('button', { name: 'Close Keeper settings', exact: true }).click();
    await mkdir('.browser-test-runtime/exploration-keeper', { recursive: true });
    await page.screenshot({ path: '.browser-test-runtime/exploration-keeper/two-workbenches-390.png' });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
