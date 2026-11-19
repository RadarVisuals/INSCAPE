import { mkdir } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { browserExecutable } from '../scripts/browserEnvironment.mjs';
import { interceptPublicationBoundary } from './fixtures/publication-boundary.mjs';
import { publishedCompositionEntries } from '../src/profileDocument/domain/publishedCanvases.js';
import { editorCommand } from './fixtures/editor-menu.mjs';
import { openSharedTool } from './fixtures/shared-tools.mjs';

const output = process.env.INSCAPE_SCREENSHOT_DIR || '.browser-test-runtime/published-works-editor';
const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
const url = origin + '/browser-tests/profile-overview-fixture.html?view=0x' + '1'.repeat(40) + '&reception=published&canvas=1&collection=1';

test('open a published Gallery work missing from Studio beside an existing private draft', { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(url + '&owner=1&publishedOnly=1');
    await page.getByRole('button', { name: 'Open Anatomy' }).click();
    assert.equal(await page.evaluate(() => window.__galleryStore.readWorkbench('workbench:anatomy')), null);
    const original = await page.evaluate(() => window.__galleryStore.readWorkbench('workbench:private'));
    await page.getByRole('button', { name: 'Edit Anatomy in Studio' }).click();
    const editor = page.locator('.editor-menu-bar[data-document="workbench:anatomy"]');
    await editor.waitFor();
    await page.reload();
    await editor.waitFor();
    assert.deepEqual(await page.evaluate(() => window.__galleryStore.readWorkbench('workbench:private')), original);
    assert.equal(await page.evaluate(() => window.__galleryStore.readWorkbench('workbench:anatomy').name), 'Anatomy');
  } finally { await browser.close(); }
});

test('Gallery shows only published work to its owner and Studio preserves draft manager navigation', { timeout: 75000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(url);
    await page.getByRole('button', { name: 'Open Anatomy' }).click();
    const index = page.getByRole('navigation', { name: 'Canvases', exact: true });
    const editButtons = page.getByRole('button', { name: /^Edit .+ in Studio$/ });
    const pencil = index.getByRole('button', { name: 'Edit Anatomy in Studio' });
    assert.equal(await editButtons.count(), 0);
    assert.equal(await page.getByRole('button', { name: '+ New', exact: true }).count(), 0);
    assert.equal(await index.getByRole('button', { name: 'Open Private experiment' }).count(), 0);
    await page.goto(url + '&owner=1');
    await index.getByRole('button', { name: 'Edit Vision in Studio' }).waitFor();
    assert.equal(await index.getByRole('button', { name: 'Open Private experiment' }).count(), 0);
    await page.getByRole('button', { name: 'Open Anatomy' }).click();
    await page.getByRole('button', { name: 'Studio', exact: true }).click();
    await page.locator('.editor-menu-bar[data-document="workbench:anatomy"]').waitFor();
    await page.getByRole('button', { name: 'Back to Gallery' }).click();
    await index.getByRole('button', { name: 'Open Vision' }).waitFor();
    await page.goto(url.replace('&reception=published', '') + '&owner=1');
    await index.getByRole('button', { name: 'Open Vision' }).waitFor();
    assert.equal(await editButtons.count(), 1);
    await page.getByRole('button', { name: 'Open Anatomy' }).click();
    await pencil.waitFor();
    assert.equal(await editButtons.count(), 1);
    assert.ok(await pencil.evaluate(el => el.previousElementSibling?.getAttribute('aria-current') === 'page'));
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    const camera = () => page.locator('.composition-explorer-viewport').evaluate(el =>
      [el.dataset.canvasId, el.dataset.cameraScale, el.dataset.cameraX, el.dataset.cameraY]);
    const original = await camera();
    await index.getByRole('button', { name: 'Open Private experiment' }).waitFor();
    const editor = page.locator('.editor-menu-bar[data-document]:visible');
    const back = page.getByRole('button', { name: 'Back to Gallery', exact: true });
    for (const motion of ['no-preference', 'reduce']) {
      await page.emulateMedia({ reducedMotion: motion });
      await pencil.click();
      await editor.waitFor();
      assert.equal(await page.locator('.editor-menu-bar[data-document]').getAttribute('data-document'), 'workbench:anatomy');
      assert.equal(new URL(page.url()).searchParams.get('work'), 'workbench:anatomy');
      if (motion === 'no-preference') {
        await page.waitForFunction(() => document.querySelector('.owner-canvas-journey[data-direction="editor"]')?.getAnimations().some(a => a.effect.getTiming().duration === 650));
      }
      await page.locator('.owner-canvas-journey').waitFor({ state: 'detached' });
      await editorCommand(page, 'Canvas', 'Manage compositions');
      if (motion === 'no-preference') {
        await page.waitForFunction(() => document.querySelector('.owner-canvas-journey[data-direction="overview"]')?.getAnimations().some(a => a.effect.getTiming().duration === 650));
      }
      await pencil.waitFor();
      await page.locator('.owner-canvas-journey').waitFor({ state: 'detached' });
      assert.deepEqual(await camera(), original);
      assert.ok(await pencil.evaluate(el => el === document.activeElement));
      assert.equal(new URL(page.url()).searchParams.get('canvas'), '1');
    }
    await page.goto(url + '&owner=1&editor=canvas&work=workbench:missing');
    await page.getByText('This work has no editable canvas in this workspace.').waitFor();
    assert.equal(await editor.count(), 0);
    await back.click();
    await index.getByRole('button', { name: 'Open Anatomy' }).waitFor();
    assert.equal(await index.getByRole('button', { name: 'Open Private experiment' }).count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('create from Profile → Gallery, compose, and reopen the saved local work across list, grid and reload', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const button = name => page.getByRole('button', { name, exact: true });
    const name = 'First composition';
    const text = 'The shape of a new world.';
    await page.goto(url.replace('&canvas=1', '') + '&owner=1');
    await page.getByRole('heading', { name: 'Nomad', exact: true }).waitFor();
    await button('Gallery').click();
    await button('+ New').click();
    await page.getByLabel('Composition name', { exact: true }).fill(name);
    await button('Create composition').click();
    await button('Text tool').click();
    const id = await page.locator('.editor-menu-bar[data-document]').getAttribute('data-document');
    assert.equal(new URL(page.url()).searchParams.get('work'), id);
    await page.mouse.click(750, 240);
    const textbox = page.getByRole('textbox', { name: 'Article text', exact: true });
    await page.locator('.text-window').waitFor();
    if (!await textbox.isVisible()) {
      await page.locator('.text-window').click({ position: { x: 80, y: 90 } });
      const tools = await openSharedTool(page, 'Text');
      const edit = tools.getByRole('button', { name: 'Edit text', exact: true });
      if (await edit.count()) await edit.click();
    }
    await textbox.fill(text);
    await editorCommand(page, 'Canvas', 'Manage compositions');
    const index = page.getByRole('navigation', { name: 'Canvases', exact: true });
    const selected = index.getByRole('button', { name: `Open ${name}`, exact: true });
    await selected.waitFor();
    assert.equal(await selected.getAttribute('aria-current'), 'page');
    await button('Grid').click();
    await button(`Open ${name}`).hover({ position: { x: 10, y: 10 } });
    await button(`Edit ${name}`).click();
    await page.locator('.text-window').getByText(text, { exact: true }).waitFor();
    await page.goBack();
    await button(`Open ${name}`).waitFor();
    await page.goForward();
    await page.locator('.text-window').getByText(text, { exact: true }).waitFor();
    await page.evaluate(() => {
      const setItem = Storage.prototype.setItem;
      window.allowFixtureSave = () => { Storage.prototype.setItem = setItem; };
      Storage.prototype.setItem = function(key, value) {
        if (key.startsWith('profile-overview-fixture:inscape.system-workflow-draft.')) throw new DOMException('Full', 'QuotaExceededError');
        return setItem.call(this, key, value);
      };
    });
    await page.goBack();
    await page.getByText('The document could not be saved. Retry its save first.', { exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('work'), id, 'Failed browser Back restores the editor URL');
    await page.locator('.text-window').getByText(text, { exact: true }).waitFor();
    await page.evaluate(() => window.allowFixtureSave());
    await editorCommand(page, 'Canvas', 'Manage compositions');
    await button(`Open ${name}`).waitFor();
    await button('View options').click();
    await button('List').click();
    await selected.waitFor();
    await page.reload();
    await index.getByRole('button', { name: `Open ${name}` }).click();
    await button(`Edit ${name} in Studio`).click();
    await page.locator('.text-window').getByText(text, { exact: true }).waitFor();
    assert.equal(await page.locator('.editor-menu-bar[data-document]').getAttribute('data-document'), id);
    await page.goto(url);
    await index.getByRole('button', { name: 'Open Vision' }).waitFor();
    assert.equal(await selected.count(), 0, 'The saved draft is still private to the owner');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('the public header and Studio share one anchor and keep account actions scoped to the signed-in reader', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    await mkdir(output, { recursive: true });
    for (const width of [1440, 760, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      page.setDefaultTimeout(8000);
      await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      const button = name => page.getByRole('button', { name, exact: true });
      const expectAvatar = file => page.waitForFunction(file => {
        const image = document.querySelector('.visitor-account-avatar img');
        return image?.complete && image.naturalWidth && new URL(image.currentSrc).pathname === '/assets/PFP/' + file;
      }, file);
      const metrics = header => header.evaluate(node => {
        const rect = node.getBoundingClientRect(), anchor = node.querySelector('.workspace-wordmark').getBoundingClientRect();
        const css = getComputedStyle(node);
        return { x: anchor.x, y: anchor.y, width: anchor.width, height: rect.height, top: rect.top,
          left: css.paddingLeft, right: css.paddingRight, border: css.borderBottomWidth, background: css.backgroundColor };
      });
      await page.goto(url);
      await page.getByRole('link', { name: 'Inscape — Discover' }).waitFor();
      assert.equal(await button('Studio').count(), 0);
      const tabs = page.getByRole('navigation', { name: 'Profile navigation' });
      assert.deepEqual(await tabs.getByRole('button').allTextContents(), ['Profile', 'Gallery', 'Writing', 'Exhibition']);
      assert.equal(await tabs.getByRole('button', { name: 'Exhibition' }).isDisabled(), true);
      await page.goto(url + '&viewer=1');
      await expectAvatar('PFP.webp');
      await button('Reader account').click();
      const account = page.locator('.visitor-tools .visitor-popover');
      assert.equal(await account.getByText('Reader', { exact: true }).count(), 1);
      assert.deepEqual(await account.locator('button,a').allTextContents(), ['Copy address', 'Universal Profile', 'Settings', 'Disconnect']);
      assert.ok((await account.getByRole('link', { name: 'Universal Profile' }).getAttribute('href')).toLowerCase().includes('2'.repeat(40)));
      await page.keyboard.press('Escape');
      assert.equal(await button('Studio').count(), 0);
      await page.goto(url + '&owner=1');
      await expectAvatar('PFP.png');
      const header = page.locator('.visitor-header');
      const publicBox = await metrics(header);
      if (width <= 390) {
        assert.ok(await tabs.evaluate(list => list.scrollWidth > list.clientWidth), 'The mobile tabs can scroll');
        const tabBox = await tabs.boundingBox(), controls = await header.locator('.visitor-tools').boundingBox();
        assert.ok(tabBox.x + tabBox.width <= controls.x, 'The tab scroller ends before the Studio controls');
        const activeTabVisible = () => tabs.evaluate(list => {
          const active = list.querySelector('[aria-current="page"]').getBoundingClientRect(), clip = list.getBoundingClientRect();
          return active.left >= clip.left - 1 && active.right <= clip.right + 1;
        });
        assert.ok(await activeTabVisible(), 'Gallery is visible on direct entry');
        const writing = new URL(url);
        writing.searchParams.delete('canvas'); writing.searchParams.delete('reception');
        writing.searchParams.set('tab', 'writing'); writing.searchParams.set('owner', '1');
        await page.goto(writing.href);
        await page.getByRole('heading', { name: 'Writing', exact: true }).waitFor();
        assert.ok(await activeTabVisible(), 'Writing is visible on direct entry');
        await tabs.getByRole('button', { name: 'Writing', exact: true }).focus();
        await page.keyboard.press('Enter');
        await page.getByRole('heading', { name: 'Writing', exact: true }).waitFor();
        await tabs.getByRole('button', { name: 'Gallery', exact: true }).click();
        await tabs.getByRole('button', { name: 'Gallery', exact: true }).waitFor();
      }
      assert.equal(publicBox.height, 48); assert.equal(publicBox.top, 0); assert.equal(publicBox.x, 16);
      assert.equal(publicBox.left, '16px'); assert.equal(publicBox.right, '16px');
      assert.equal(publicBox.border, '0px'); assert.equal(publicBox.background, 'rgba(0, 0, 0, 0)');
      await button('Inscape menu').click();
      const menu = page.getByRole('menu', { name: 'Inscape menu', exact: true });
      assert.deepEqual(await menu.getByRole('menuitemcheckbox').locator('span').allTextContents(),
        ['Profile', 'Gallery', 'Writing', 'Exhibition', 'Studio', 'Discover']);
      assert.equal(await menu.getByRole('menuitemcheckbox', { name: 'Gallery' }).getAttribute('aria-checked'), 'true');
      assert.equal(await menu.getByRole('menuitem', { name: 'Canvas' }).count(), 0);
      assert.equal(await menu.getByRole('menuitem', { name: 'Backup' }).count(), 0);
      await page.screenshot({ path: output + '/gallery-menu-' + width + '.png' });
      await page.keyboard.press('Escape');
      await button('Studio').click();
      const studio = page.locator('.editor-menu-bar[data-document]:visible');
      await studio.waitFor(); await page.locator('.owner-canvas-journey').waitFor({ state: 'detached' });
      const editorBox = await metrics(studio);
      const { border, background, ...publicGeometry } = publicBox;
      const { border: studioBorder, background: studioBackground, ...studioGeometry } = editorBox;
      assert.deepEqual(studioGeometry, publicGeometry);
      assert.equal(studioBorder, '1px'); assert.notEqual(studioBackground, background);
      assert.equal(await studio.locator('.visitor-account-avatar, .visitor-tabs').count(), 0);
      await button('Inscape menu').click();
      assert.equal(await menu.getByRole('menuitemcheckbox', { name: 'Studio' }).getAttribute('aria-checked'), 'true');
      for (const label of ['Search commands...', 'Canvas', 'Edit', 'View', 'Tools', 'Backup']) {
        assert.equal(await menu.getByRole('menuitem', { name: label, exact: true }).count(), 1);
      }
      await page.screenshot({ path: output + '/studio-menu-' + width + '.png' });
      await page.keyboard.press('Escape');
      await button('Back to Gallery').click();
      await expectAvatar('PFP.png');
      await page.close();
    }
  } finally { await browser.close(); }
});

test('unpublished Gallery and Writing remain navigable with creation available to the owner', { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const tabs = page.getByRole('navigation', { name: 'Profile navigation' });
    const create = page.getByRole('button', { name: '+ New', exact: true });
    for (const session of ['', '&viewer=1', '&owner=1']) {
      await page.goto(url + '&unpublished=1' + session);
      await page.getByRole('heading', { name: 'Gallery', exact: true }).waitFor();
      await page.getByText('No compositions in Gallery yet.').waitFor();
      assert.deepEqual(await tabs.getByRole('button').allTextContents(), ['Profile', 'Gallery', 'Writing', 'Exhibition']);
      assert.equal(await create.count(), session === '&owner=1' ? 1 : 0);
      assert.equal(await page.getByRole('button', { name: 'Open Private experiment' }).count(), 0);
      await tabs.getByRole('button', { name: 'Writing' }).click();
      await page.getByRole('heading', { name: 'Writing' }).waitFor();
      await page.getByText('No published writing yet.').waitFor();
      assert.equal(await tabs.getByRole('button', { name: 'Writing' }).getAttribute('aria-current'), 'page');
    }
    await tabs.getByRole('button', { name: 'Gallery' }).click();
    await create.click();
    await page.getByRole('button', { name: 'Create composition' }).waitFor();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const [title, flag, width, linked] of [
  ['Vision', 'last-gallery', 1440, false], ['Mixed study', 'mixed', 390, true],
]) test('remove ' + title + ' from the published Gallery and keep its Studio draft', { timeout: 45000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const touch = width === 390;
    const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: touch, reducedMotion: 'reduce' });
    const errors = [];
    page.setDefaultTimeout(8000);
    page.on('pageerror', error => errors.push(error.message));
    const network = await interceptPublicationBoundary(page, origin);
    const gallery = url + '&' + flag + '=1';
    const openWork = page.getByRole('button', { name: 'Open ' + title, exact: true });
    const select = page.getByRole('button', { name: 'Select', exact: true });
    const remove = page.getByRole('button', { name: 'Remove selected (1)', exact: true });
    const sheet = page.getByRole('dialog', { name: 'Remove from Gallery', exact: true });
    const draft = () => page.evaluate(() => window.__galleryStore.getBackupSnapshot());
    const names = document => publishedCompositionEntries(document, 'profile').map(entry => entry.name);
    for (const reader of ['', '&viewer=1']) {
      await page.goto(gallery + reader);
      await openWork.waitFor();
      assert.equal(await select.count(), 0);
    }
    await page.goto(gallery + '&owner=1');
    await openWork.waitFor();
    const snapshot = await draft();
    const previous = await page.evaluate(() => window.__overviewPublication);
    const showRemove = async () => {
      await select.click();
      await page.getByRole('checkbox', { name: 'Select ' + title, exact: true }).check();
      await remove.click();
      await sheet.waitFor();
      const review = await sheet.innerText();
      assert.ok(review.includes(title));
      assert.match(review, /local Studio (draft|composition)/i);
      assert.match(review, linked ? /stays? on Profile|still appear on Profile/i : /leaves? the current publication/i);
    };
    await showRemove();
    await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
    await sheet.waitFor({ state: 'detached' });
    assert.ok(await remove.evaluate(node => node === document.activeElement), 'Cancel returns focus to the batch action');
    assert.equal(network.uploads, 0); assert.equal(network.writes, 0);
    assert.deepEqual(await draft(), snapshot);

    await remove.click();
    const prepare = sheet.getByRole('button', { name: 'Prepare publication', exact: true });
    await prepare.waitFor();
    assert.ok(await prepare.isEnabled(), await sheet.innerText());
    await prepare.click();
    await sheet.getByRole('button', { name: 'Make presentation public', exact: true }).waitFor();
    assert.equal(network.uploads, 0); assert.equal(network.writes, 0);
    await sheet.getByRole('button', { name: 'Make presentation public', exact: true }).click();
    const submit = sheet.getByRole('button', { name: 'Publish to profile', exact: true });
    await submit.waitFor();
    assert.equal(network.uploads, 1); assert.equal(network.writes, 0);
    const next = JSON.parse(network.bytes);
    assert.deepEqual(publishedCompositionEntries(next, 'gallery'), []);
    assert.deepEqual(names(next), names(previous));
    assert.equal(names(next).includes(title), linked);
    await submit.click();
    const receipt = page.getByLabel('Publication complete');
    await receipt.getByText('Removed from Gallery', { exact: true }).waitFor();
    assert.ok((await receipt.getByRole('status').innerText()).includes(title));
    await receipt.getByRole('button', { name: 'Dismiss publication confirmation' }).click();
    await page.getByText('No compositions in Gallery yet.', { exact: true }).waitFor();
    assert.equal(network.writes, 1);
    await page.reload();
    await page.getByText('No compositions in Gallery yet.', { exact: true }).waitFor();
    assert.deepEqual(await draft(), snapshot);
    await page.getByRole('navigation', { name: 'Profile navigation' }).getByRole('button', { name: 'Profile', exact: true }).click();
    await page.getByRole('heading', { name: 'Nomad', exact: true }).waitFor();
    assert.equal(await openWork.count(), linked ? 1 : 0);
    assert.equal(await select.count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('a changed verified Gallery stops removal before the wallet write', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(8000);
    const network = await interceptPublicationBoundary(page, origin);
    await page.goto(url + '&owner=1&bulk=1&changed-publication=1');
    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await page.getByRole('button', { name: 'Select all', exact: true }).click();
    await page.getByRole('button', { name: 'Remove selected (3)', exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Remove from Gallery', exact: true });
    await page.evaluate(() => {
      window.__pausePublicationVerification = () => new Promise(resolve => { window.__finishPublicationVerification = resolve; });
    });
    for (const label of ['Prepare publication', 'Make presentation public', 'Publish to profile']) {
      await sheet.getByRole('button', { name: label, exact: true }).click();
    }
    await page.waitForFunction(() => typeof window.__finishPublicationVerification === 'function');
    const cancel = sheet.getByRole('button', { name: 'Cancel', exact: true });
    assert.equal(await cancel.isDisabled(), true);
    await page.keyboard.press('Escape');
    assert.equal(await sheet.isVisible(), true);
    assert.equal(network.writes, 0);
    await page.evaluate(() => window.__finishPublicationVerification());
    await sheet.getByText(/Gallery has changed/i).waitFor();
    assert.equal(network.writes, 0);
    await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
    const selection = page.getByRole('group', { name: 'Gallery selection', exact: true });
    await selection.getByRole('button', { name: 'Remove selected (3)' }).waitFor();
    assert.equal(await page.getByRole('checkbox', { name: 'Select Vision', exact: true }).isChecked(), true);
    await selection.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Open Vision', exact: true }).waitFor();
  } finally { await browser.close(); }
});

for (const [width, removeEverything] of [[1440, false], [390, true]]) {
  test('batch removal in the published Gallery at ' + width + 'px uses one publication', { timeout: 50000 }, async () => {
    const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height: 900 }, hasTouch: width === 390, reducedMotion: 'reduce' });
      page.setDefaultTimeout(10000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const network = await interceptPublicationBoundary(page, origin);
      await page.goto(url + '&bulk=1&owner=1');
      const button = name => page.getByRole('button', { name, exact: true });
      const checkbox = name => page.getByRole('checkbox', { name: 'Select ' + name, exact: true });
      const sheet = page.getByRole('dialog', { name: 'Remove from Gallery', exact: true });
      const snapshot = () => page.evaluate(() => window.__galleryStore.getBackupSnapshot());
      await button('Select').waitFor();
      await page.locator(removeEverything ? '.workbench-overview-gallery' : '.composition-index').waitFor();
      const before = await snapshot();
      const original = await page.evaluate(() => window.__overviewPublication);

      await button('Select').click();
      assert.equal(await page.getByRole('checkbox').count(), 3);
      assert.equal(await checkbox('Private experiment').count(), 0);
      assert.equal(await checkbox('Profile link').count(), 0);
      assert.equal(await button('Remove selected (0)').isDisabled(), true);
      await checkbox('Bento').check();
      await button('Cancel').click();
      await button('Select').waitFor();
      assert.equal(network.writes, 0);
      assert.deepEqual(await snapshot(), before);

      await button('Select').click();
      await button('Select all').click();
      for (const name of ['Vision', 'Anatomy', 'Bento']) assert.equal(await checkbox(name).isChecked(), true);
      await button('Deselect all').click();
      assert.equal(await button('Remove selected (0)').isDisabled(), true);
      await button('Select all').click();
      if (!removeEverything) await checkbox('Anatomy').uncheck();
      const selected = removeEverything ? ['Vision', 'Anatomy', 'Bento'] : ['Vision', 'Bento'];
      const remove = button('Remove selected (' + selected.length + ')');
      await remove.click();
      const impacts = sheet.getByRole('list', { name: 'Selected works' });
      await impacts.waitFor();
      assert.equal(await impacts.getByRole('listitem').count(), selected.length);
      for (const name of selected) {
        const item = impacts.getByRole('listitem').filter({ hasText: name });
        assert.match(await item.innerText(), name === 'Bento' ? /stays on Profile/i : /leaves the current publication/i);
      }
      await sheet.getByRole('button', { name: 'Cancel', exact: true }).click();
      await remove.waitFor();
      await page.waitForFunction(() => document.activeElement?.textContent.includes('Remove selected'));
      for (const name of selected) assert.equal(await checkbox(name).isChecked(), true);
      assert.equal(network.uploads, 0); assert.equal(network.writes, 0);
      await remove.click();
      await sheet.getByRole('button', { name: 'Prepare publication', exact: true }).click();
      await sheet.getByRole('button', { name: 'Make presentation public', exact: true }).click();
      const publish = sheet.getByRole('button', { name: 'Publish to profile', exact: true });
      await publish.waitFor();
      assert.equal(network.uploads, 1); assert.equal(network.writes, 0);
      const next = JSON.parse(network.bytes);
      assert.deepEqual(publishedCompositionEntries(next, 'gallery').map(item => item.name), removeEverything ? [] : ['Anatomy']);
      const retained = document => publishedCompositionEntries(document, 'profile').map(entry => {
        const { destinations, ...content } = entry; return content;
      });
      assert.deepEqual(retained(next), retained(original), 'profile placements retain their published artwork');
      await publish.click();
      const receipt = page.getByLabel('Publication complete');
      await receipt.getByText('Removed from Gallery', { exact: true }).waitFor();
      const status = receipt.getByRole('status');
      assert.ok((await status.innerText()).includes(String(selected.length)));
      assert.deepEqual((await status.getByRole('listitem').allTextContents()).sort(), selected.slice().sort());
      assert.equal(new URL(await receipt.getByRole('link', { name: 'View Gallery' }).getAttribute('href'), origin).searchParams.get('tab'), 'gallery');
      assert.match(await receipt.getByRole('link', { name: 'View transaction' }).getAttribute('href'), /\/tx\/0xa{64}$/u);
      await receipt.getByRole('button', { name: 'Dismiss publication confirmation' }).click();
      await page.reload();
      if (removeEverything) await page.getByText('No compositions in Gallery yet.', { exact: true }).waitFor();
      else await button('Open Anatomy').waitFor();
      assert.equal(await button('Open Vision').count(), 0);
      assert.equal(await button('Open Bento').count(), 0);
      await page.getByRole('navigation', { name: 'Profile navigation' }).getByRole('button', { name: 'Profile' }).click();
      await button('Open Bento').waitFor(); await button('Open Profile link').waitFor();
      assert.deepEqual(await snapshot(), before);
      assert.equal(network.writes, 1); assert.equal(network.uploads, 1);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
}

test('a rejected bulk upload includes the server error code and upload phase in copied support details', { timeout: 30000 }, async () => {
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(8000);
    const network = await interceptPublicationBoundary(page, origin);
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async value => { window.__copiedPublicationReport = value; } },
    }));
    const providerDetail = 'Synthetic upstream message with a private identifier';
    await page.route('**/api/profile-publications', route => {
      if (route.request().method() !== 'POST') return route.fallback();
      return route.fulfill({ status: 429, headers: { 'content-type': 'application/json', 'access-control-allow-origin': origin },
        body: JSON.stringify({ error: { code: 'UPLOAD_PROFILE_QUOTA', message: providerDetail } }) });
    });
    await page.goto(url + '&bulk=1&owner=1');
    for (const label of ['Select', 'Select all', 'Remove selected (3)']) await page.getByRole('button', { name: label, exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Remove from Gallery', exact: true });
    await sheet.getByRole('button', { name: 'Prepare publication', exact: true }).click();
    await sheet.getByRole('button', { name: 'Make presentation public', exact: true }).click();
    await sheet.getByText('Help with this error', { exact: true }).click();
    await sheet.getByRole('button', { name: 'COPY DETAILS', exact: true }).click();
    const report = await page.evaluate(() => window.__copiedPublicationReport);
    assert.match(report, /code:\s*UPLOAD_PROFILE_QUOTA/i);
    assert.match(report, /phase:\s*IPFS_UPLOAD/i);
    assert.ok(!report.includes(providerDetail));
    assert.equal(network.writes, 0);
    assert.equal(await page.getByLabel('Publication complete').count(), 0);
  } finally { await browser.close(); }
});
