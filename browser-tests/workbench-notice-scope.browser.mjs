import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_SYSTEM_WORKFLOW_ROOT || 'http://127.0.0.1:5173';
const output = process.env.INSCAPE_SYSTEM_WORKFLOW_SCREENSHOT_DIR || '.browser-test-runtime';
const message = 'The Display settings could not be saved';
const advance = (page, time = 32) => page.clock.runFor(time);

async function mount(page) {
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.route(`${origin}/__notice_scope__`, route => route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }));
  await page.goto(`${origin}/__notice_scope__`);
  await page.evaluate(async () => {
    const refresh = (await import('/@react-refresh')).default;
    refresh.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    const React = (await import('/@id/react')).default;
    const { createRoot } = (await import('/@id/react-dom/client')).default;
    const Runtime = (await import('/src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx')).default;
    const fixture = await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js');
    const { createSystemWorkflowDraftStore, systemWorkflowDraftKey } = await import('/src/systemWorkflow/systemWorkflowDraftStore.js');
    const { addDisplayModule } = await import('/src/systemWorkflow/displayModuleSession.js');
    const { createDefaultWorkbenchPresentation, createNewDisplayPresentation } = await import('/src/profileDocument/domain/workbenchPresentation.js');
    const profileAddress = fixture.OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE, key = systemWorkflowDraftKey(profileAddress);
    const records = new Map([[key, fixture.createOwnerSystemWorkflowReviewStorage().getItem(key)]]);
    window.noticeFault = false; window.noticeAttempts = 0; window.noticeWrites = 0;
    const storage = { getItem: name => records.get(name) ?? null, setItem: (name, value) => {
      if (name === key) { window.noticeAttempts++; if (window.noticeFault) throw Error('Storage full'); window.noticeWrites++; }
      records.set(name, value);
    } };
    const store = createSystemWorkflowDraftStore({ profileAddress, storage });
    const second = addDisplayModule(store), draft = store.getDraft(), workbench = createDefaultWorkbenchPresentation();
    workbench.display = { ...workbench.display, name: 'FIRST', window: { left: 20, top: 100, width: 320, height: 180 } };
    workbench.displays = [{ id: second, ...createNewDisplayPresentation('LANDSCAPE', 1), name: 'SECOND',
      window: { left: innerWidth > 700 ? 520 : 20, top: innerWidth > 700 ? 100 : 380, width: 320, height: 180 } }];
    draft.workbench = workbench;
    if (!store.commitCompletedOperation(draft, { expectedGeneration: store.getGeneration() })) throw Error('Notice fixture failed');
    window.noticeSaved = () => records.get(key); window.noticeBefore = records.get(key);
    window.noticeFault = true; window.noticeAttempts = 0; window.noticeWrites = 0;
    await import('/src/index.css'); await import('/src/inscapeTokens.css'); await import('/src/public/ownerSystemWorkflow/ownerSystemWorkflow.css'); await import('/src/lattice/rendering/latticeMenuSurface.css');
    createRoot(document.getElementById('root')).render(React.createElement(Runtime, { profileAddress, reviewStorage: storage,
      reviewAssets: [], reviewCategories: [], reviewActivity: [], reviewDiscovery: [], reviewProfile: { name: 'Notice scope' } }));
  });
  await page.locator('[data-display-instance]').nth(1).waitFor();
  await page.clock.install(); await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
}

async function select(page, index) {
  await page.locator('[data-display-instance]').nth(index).getByLabel(/Move Display Module:/).focus();
  await advance(page);
}

async function failFormat(page, index) {
  const before = await page.evaluate(() => window.noticeAttempts);
  await select(page, index); await page.keyboard.press('Shift+F10'); await advance(page);
  await page.getByRole('menuitem', { name: 'FORMAT', exact: true }).press('Enter'); await advance(page);
  await page.getByRole('menuitemcheckbox', { name: 'VERTICAL 9:16', exact: true }).press('Enter'); await advance(page);
  assert.equal(await page.evaluate(() => window.noticeAttempts), before + 1, 'the intended canonical save actually failed');
  assert.equal(await page.getByRole('button', { name: 'Dismiss notification' }).innerText(), message);
}

for (const width of [1440, 390]) for (const mode of ['dismiss', 'timer', 'replacement']) {
  test(`Workbench notification ${mode} retains each Display failure (${width}px)`, { timeout: 90000 }, async () => {
    const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
    try {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await mount(page); const notice = page.getByRole('button', { name: 'Dismiss notification' });
      await mkdir(output, { recursive: true });
      await failFormat(page, 0); await advance(page, 2000);
      if (mode === 'replacement') {
        // The same words describe a new failed operation in the same owner.
        await failFormat(page, 0); await advance(page, 2700);
        assert.equal(await notice.innerText(), message, 'an older timer cannot clear a newer identical failure');
        await page.screenshot({ path: join(output, `notice-newer-${width}.png`) });
        await advance(page, 1900); assert.equal(await notice.count(), 0);
      } else {
        await failFormat(page, 1);
        if (mode === 'dismiss') {
          const box = await notice.boundingBox(), point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
          assert.equal(await notice.evaluate((node, point) => node.contains(document.elementFromPoint(point.x, point.y)), point), true);
          await page.mouse.click(point.x, point.y); await advance(page);
        }
        else {
          await advance(page, 2700);
          assert.equal(await notice.innerText(), message, 'switching owners starts the visible failure lifetime');
          await advance(page, 1900);
        }
        assert.equal(await notice.count(), 0, 'only the currently shown failure was dismissed');
        await select(page, 0);
        assert.equal(await notice.innerText(), message, 'the other Display retains its undisplayed failure');
      }
      assert.equal(await page.evaluate(() => window.noticeSaved()), await page.evaluate(() => window.noticeBefore), 'both Display drafts remain unchanged');
      assert.equal(await page.evaluate(() => window.noticeWrites), 0);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: join(output, `notice-${mode}-${width}.png`) });
    } finally { await browser.close(); }
  });
}
