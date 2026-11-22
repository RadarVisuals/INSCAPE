import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright-core';

const origin = process.env.INSCAPE_TEST_ORIGIN || 'http://127.0.0.1:5173';
async function withPage(run) {
  const browser = await chromium.launch({ executablePath: process.env.INSCAPE_BROWSER_EXECUTABLE, headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(origin + '/browser-tests/workspace-idb-fixture.html');
    await page.waitForFunction(() => !!window.fixture);
    await run(page);
  } finally { await browser.close(); }
}

test('legacy work is verified, grows beyond 5 MiB and survives reload and backup restore', () => withPage(async page => {
  const legacy = await page.evaluate(() => fixture.seed());
  const before = await page.evaluate(() => fixture.start());
  assert.deepEqual(before, { revision:1, status:'ready', count:1, folder:'Props', snapshotCount:1,
    active:'workbench:second', works:2, title:'Unpublished field notes', recovery:'Pending revision' });
  const large = await page.evaluate(() => fixture.grow());
  assert.ok(large.bytes > 5 * 1024 * 1024);
  assert.equal(large.status, 'saving');
  assert.equal(large.saved, true);
  await page.reload();
  await page.waitForFunction(() => !!window.fixture);
  const reloaded = await page.evaluate(() => fixture.start());
  assert.deepEqual(reloaded, {...before, count:760, snapshotCount:760, revision:2});
  assert.equal((await page.evaluate(() => fixture.restore())).saved, true);
  await page.reload();
  await page.waitForFunction(() => !!window.fixture);
  const restored = await page.evaluate(() => fixture.start());
  assert.equal(restored.title, 'Restored field notes');
  assert.equal(restored.recovery, undefined);
  assert.ok(restored.revision > reloaded.revision);
  assert.deepEqual(await page.evaluate(() => fixture.legacy()), legacy);
}));

test('a persisted pending article is seeded and its legacy bytes remain intact', () => withPage(async page => {
  const seeded = await page.evaluate(async () => {
    fixture.seed();
    const key = 'inscape.text-recovery.v1:' + fixture.profile;
    const raw = JSON.stringify([[fixture.profile + '/workbench:second', [{
      scope: { profile: fixture.profile, id: 'text:author' },
      expected: JSON.parse(localStorage.getItem(fixture.keys[1])).workbenches[1].content.texts[0],
      value: { title: 'Retained article' },
      failure: { reason: 'write_failed', message: 'Unsaved' },
    }]]]);
    localStorage.setItem(key, raw);
    return { key, raw };
  });
  await page.reload();
  await page.waitForFunction(() => !!window.fixture);
  assert.equal((await page.evaluate(() => fixture.start())).recovery, 'Retained article');
  assert.equal(await page.evaluate(key => localStorage.getItem(key), seeded.key), seeded.raw);
}));

test('quota abort retains the edit in memory and advances the revision only on retry', () => withPage(async page => {
  const result = await page.evaluate(async () => {
    fixture.seed(); await fixture.start();
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(...args) {
      if (this.name === 'records') throw new DOMException('Full','QuotaExceededError');
      return put.apply(this,args);
    };
    const state = fixture.library();
    state.createFolder('Retained edit');
    const rejected = await fixture.confirmWorkspaceSaved(fixture.profile);
    const failed = fixture.workspaceSession(fixture.profile).state;
    IDBObjectStore.prototype.put = put;
    const retry = await fixture.confirmWorkspaceSaved(fixture.profile);
    return {rejected, failed, retry, revision:fixture.workspaceSession(fixture.profile).revision,
      names:fixture.library().workspace.folders.map(folder => folder.name)};
  });
  assert.equal(result.rejected,false);
  assert.equal(result.failed.status,'unsaved');
  assert.equal(result.failed.revision,1);
  assert.equal(result.retry,true); assert.equal(result.revision,2);
  assert.deepEqual(result.names,['Props','Retained edit']);
}));

test('obsolete hydration cannot switch the active Library back or seed invalid legacy records', () => withPage(async page => {
  const result = await page.evaluate(async () => {
    const original = fixture.seed();
    const {profile, second} = fixture;
    fixture.library().setProfileAddress(profile);
    fixture.library().setProfileAddress(second);
    await Promise.all([fixture.hydrateWorkspace(second),fixture.hydrateWorkspace(profile)]);
    const active = fixture.library().workspace.profileAddress;
    const third = '0x' + 'c'.repeat(40);
    localStorage.setItem(fixture.keys[1].replace(profile,third),'{broken');
    const blocked = await fixture.hydrateWorkspace(third);
    return {active, second, status:blocked.state.status, same:JSON.stringify(original) === JSON.stringify(fixture.legacy())};
  });
  assert.equal(result.active,result.second);
  assert.equal(result.status,'blocked'); assert.equal(result.same,true);
}));


test('an interrupted seed cannot become authoritative with different legacy bytes', () => withPage(async page => {
  const result = await page.evaluate(async () => {
    const scope = [42, fixture.profile], seed = {library:'old',workbenches:null,receptionRecovery:null,textRecovery:null};
    let n = 0, mismatch;
    try {
      await fixture.openWorkspaceDatabase(indexedDB, scope, () => ({...seed,library:++n === 1 ? 'old' : 'changed'}), () => {});
    } catch (error) { mismatch = error.message; }
    const repaired = await fixture.openWorkspaceDatabase(indexedDB, scope, () => ({...seed, library:"changed"}), () => {});
    repaired.db.close();
    return {mismatch, revision:repaired.revision, library:repaired.rows.library};
  });
  assert.match(result.mismatch,/read-back differs/);
  assert.equal(result.revision,1); assert.equal(result.library,'changed');
}));

test('denied IndexedDB keeps verified legacy data and subsequent edits in this tab', () => withPage(async page => {
  const result = await page.evaluate(async () => {
    const legacy = fixture.seed();
    Object.defineProperty(window, 'indexedDB', {value: {open() { throw new DOMException('Denied','SecurityError'); }}});
    const session = await fixture.hydrateWorkspace(fixture.profile);
    fixture.library().setProfileAddress(fixture.profile);
    fixture.library().createFolder('Unsaved folder');
    return {status:session.state.status, message:session.state.message, saved:await fixture.confirmWorkspaceSaved(fixture.profile),
      names:fixture.library().workspace.folders.map(folder => folder.name), same:JSON.stringify(legacy) === JSON.stringify(fixture.legacy())};
  });
  assert.equal(result.status,'memory'); assert.match(result.message,/stay in this tab/);
  assert.equal(result.saved,false); assert.equal(result.same,true);
  assert.deepEqual(result.names,['Props','Unsaved folder']);
}));

test('two writers with the same starting bytes cannot overwrite each other', () => withPage(async a => {
  const b = await a.context().newPage();
  await a.evaluate(async () => { fixture.seed(); await fixture.start(); });
  await b.goto(a.url()); await b.waitForFunction(() => !!window.fixture);
  await b.evaluate(async () => { await fixture.start(); });
  // Start stale commands deliberately. The DB must protect itself even when a
  // tab has not received the browser's cross-tab notification yet.
  await b.evaluate(() => { window.staleRaw = fixture.workspaceSession(fixture.profile).rows.library; });
  await a.evaluate(async () => {
    fixture.library().createFolder('First writer'); await fixture.confirmWorkspaceSaved(fixture.profile);
  });
  await b.waitForFunction(() => fixture.library().workspace.folders.some(folder => folder.name === 'First writer'));
  assert.match(await b.evaluate(async () => {
    const session = fixture.workspaceSession(fixture.profile);
    try { await fixture.commitWorkspaceRows(session.db, session.scope, [['library', {before:window.staleRaw, after:null}]]); }
    catch (error) { return error.message; }
    return '';
  }), /another tab/);
  await b.evaluate(() => fixture.library().createFolder('Second writer'));
  assert.equal(await b.evaluate(() => fixture.confirmWorkspaceSaved(fixture.profile)),true);
  await a.waitForFunction(() => fixture.library().workspace.folders.some(folder => folder.name === 'Second writer'));
  assert.equal(await a.evaluate(() => fixture.library().workspace.folders.length),3);
  await b.close();
}));

test('Curation waits for delayed hydration before mounting its editable destination', () => withPage(async page => {
  await page.route('https://**/*', route => route.abort());
  await page.evaluate(() => {
    fixture.seed();
    const open = indexedDB.open.bind(indexedDB);
    indexedDB.open = (...args) => {
      const request = {};
      window.resumeWorkspaceOpen = () => {
        const actual = open(...args);
        for (const type of ['upgradeneeded','success','error','blocked']) {
          actual.addEventListener(type, event => {
            if (type === 'success' || type === 'upgradeneeded') request.result = actual.result;
            if (type === 'error') request.error = actual.error;
            request['on' + type]?.(event);
          });
        }
      };
      return request;
    };
    fixture.mount();
  });
  await page.getByText('Opening your saved workspace…').waitFor();
  assert.equal(await page.locator('[data-curation-pane="destination"]').count(),0);
  await page.waitForFunction(() => !!window.resumeWorkspaceOpen);
  await page.evaluate(() => window.resumeWorkspaceOpen());
  const right = page.locator('[data-curation-pane="destination"]');
  await right.getByRole('button',{name:'Prop 1',exact:true}).waitFor();
  await right.getByRole('button',{name:'Props',exact:true}).click();
  await right.getByRole('button',{name:'Prop 1',exact:true}).waitFor();
  assert.equal(await page.evaluate(() => fixture.workspaceSession(fixture.profile).revision),1);
}));
