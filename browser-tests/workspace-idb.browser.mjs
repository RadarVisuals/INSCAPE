import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
    const backup = JSON.parse(fixture.serializeWorkspaceRecovery(fixture.profile));
    IDBObjectStore.prototype.put = put;
    const retry = await fixture.confirmWorkspaceSaved(fixture.profile);
    return {rejected, failed, retry, recoveryFolders:backup.workspace.library.folders.map(folder => folder.name), revision:fixture.workspaceSession(fixture.profile).revision,
      names:fixture.library().workspace.folders.map(folder => folder.name)};
  });
  assert.equal(result.rejected,false);
  assert.equal(result.failed.status,'unsaved');
  assert.equal(result.failed.revision,1);
  assert.equal(result.retry,true); assert.equal(result.revision,2);
  assert.deepEqual(result.names,['Props','Retained edit']);
  assert.deepEqual(result.recoveryFolders, result.names);
  assert.equal(result.failed.lastExportedAt, null);
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
  await page.route('https://**/*', route => route.abort());
  await page.evaluate(() => { fixture.mount(); fixture.editTabWork(); });
  const file = JSON.parse(await downloadTabRecovery(page));
  assert.equal(file.workspaceRevision, 0);
  assert.deepEqual(file.workspace.library.folders.map(folder => folder.name), result.names);
  assert.equal(file.workspace.workbenches.workbenches[1].name, 'Tab composition');
  assert.equal(file.workspace.textRecovery[0][1][0].value.article.title, 'Tab article recovery');
  assert.equal(await page.evaluate(() => fixture.workspaceSession(fixture.profile).state.status), 'memory');
}));

async function downloadTabRecovery(page) {
  const button = page.getByRole('button', { name: 'Download tab recovery' });
  const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
  assert.match(download.suggestedFilename(), /^inscape-workspace-recovery-.*\.json$/);
  return readFile(await download.path(), 'utf8');
}

test('Curation downloads the losing writer and restores its edits without touching the winning tab', () => withPage(async a => {
  await a.context().route('https://**/*', route => route.abort());
  await a.evaluate(async () => { fixture.seed(); fixture.seedReceptionRecovery(); await fixture.start(); fixture.mount(); });
  const b = await a.context().newPage();
  // A suspended tab can miss a commit notification. Keep its hydrated revision stale.
  await b.addInitScript(() => { window.BroadcastChannel = undefined; });
  await b.goto(a.url()); await b.waitForFunction(() => !!window.fixture);
  await b.evaluate(async () => { await fixture.start(); fixture.mount(); });
  await b.locator('[data-curation-pane="destination"]').waitFor();
  assert.equal(await a.evaluate(async () => {
    fixture.library().createFolder('Winning folder');
    return fixture.confirmWorkspaceSaved(fixture.profile);
  }), true);
  assert.equal(await b.evaluate(async () => {
    fixture.library().createFolder('Tab folder');
    fixture.editTabWork();
    return fixture.confirmWorkspaceSaved(fixture.profile);
  }), false);
  const source = await downloadTabRecovery(b), file = JSON.parse(source);
  assert.deepEqual(file.workspace.library.folders.map(folder => folder.name), ['Props', 'Tab folder']);
  assert.equal(file.workspace.workbenches.workbenches[1].name, 'Tab composition');
  assert.equal(file.workspace.textRecovery[0][1][0].value.article.title, 'Tab article recovery');
  assert.equal(file.workspace.receptionRecovery.draft.reception.branding.name, 'Previous Reception');
  assert.equal(file.workspaceRevision, 1);
  assert.equal(await b.evaluate(() => fixture.workspaceSession(fixture.profile).state.status), 'unsaved');
  await a.reload(); await a.waitForFunction(() => !!window.fixture);
  const winner = await a.evaluate(async () => {
    await fixture.start();
    const { rows, lastExportedAt, revision } = fixture.workspaceSession(fixture.profile);
    return { names: JSON.parse(rows.library).folders.map(folder => folder.name), lastExportedAt, revision };
  });
  assert.deepEqual(winner, { names: ['Props', 'Winning folder'], lastExportedAt: null, revision: 2 });

  const fresh = await a.context().browser().newContext();
  try {
    const restored = await fresh.newPage();
    await restored.goto(a.url()); await restored.waitForFunction(() => !!window.fixture);
    await restored.evaluate(async source => {
      await fixture.applyWorkspaceRestore(await fixture.previewWorkspaceRestore(source, fixture.profile), () => true);
    }, source);
    await restored.reload(); await restored.waitForFunction(() => !!window.fixture);
    assert.deepEqual(await restored.evaluate(async () => {
      await fixture.start();
      let workspace;
      await fixture.exportWorkspaceBackup(fixture.profile, value => { workspace = JSON.parse(value).workspace; });
      return workspace;
    }), file.workspace);
  } finally { await fresh.close(); }
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

test('offline restore into empty origin storage preserves a complete portable workspace', () => withPage(async page => {
  const source = await page.evaluate(async () => {
    fixture.seed(); fixture.seedReceptionRecovery(); await fixture.start(); fixture.nestedLibrary();
    let source;
    await fixture.exportWorkspaceBackup(fixture.profile, value => { source = value; });
    return source;
  });
  const copy = JSON.parse(source);
  assert.equal(copy.kind, 'inscape-workspace-backup');
  assert.equal(copy.workspace.receptionRecovery.draft.reception.branding.name, 'Previous Reception');
  assert.equal(copy.workspace.library.folders[1].parentId, copy.workspace.library.folders[0].id);
  assert.equal(copy.workspace.library.curatedImageSelections.length, 2);
  assert.equal(copy.workspace.workbenches.workbenches.length, 2);
  assert.equal(copy.schemaVersion, 2);
  for (const record of [copy.workspace.workbenches, copy.workspace.receptionRecovery.draft]) {
    for (const { content } of record.workbenches || [{ content: record }]) {
      assert.equal('grids' in content || 'displays' in content, false);
      assert.equal('display' in (content.workbench || {}) || 'displays' in (content.workbench || {}), false);
    }
  }
  // Close the writer, then clear this disposable origin exactly as DevTools does.
  const clean = page.context(), fixtureUrl = page.url();
  await page.close();
  try {
    const tab = await clean.newPage();
    const devtools = await clean.newCDPSession(tab);
    await devtools.send('Storage.clearDataForOrigin', { origin: new URL(fixtureUrl).origin, storageTypes: 'all' });
    await devtools.detach();
    await tab.goto(fixtureUrl); await tab.waitForFunction(() => !!window.fixture);
    await clean.setOffline(true);
    const result = await tab.evaluate(async source => {
      const before = await fixture.hydrateWorkspace(fixture.profile);
      if (Object.values(before.rows).some(Boolean)) throw Error('Dirty test context.');
      const plan = await fixture.previewWorkspaceRestore(source, fixture.profile);
      await fixture.applyWorkspaceRestore(plan, () => true);
      let restored;
      await fixture.exportWorkspaceBackup(fixture.profile, value => { restored = JSON.parse(value); });
      return { workspace: restored.workspace, active: await fixture.start() };
    }, source);
    assert.deepEqual(result.workspace, copy.workspace);
    assert.equal(result.active.recovery, 'Pending revision');
    assert.equal(result.active.title, 'Unpublished field notes');
    await clean.setOffline(false);
    await tab.reload(); await tab.waitForFunction(() => !!window.fixture);
    assert.deepEqual(await tab.evaluate(() => fixture.start()), result.active);
  } finally { await clean.close(); }
}));

test('preview rejects corrupt backups; merge preserves the local article and copies a conflicting Workbench', () => withPage(async page => {
  const result = await page.evaluate(async () => {
    fixture.seed(); await fixture.start(); fixture.nestedLibrary();
    let backup;
    await fixture.exportWorkspaceBackup(fixture.profile, value => { backup = JSON.parse(value); });
    const session = fixture.workspaceSession(fixture.profile);
    const before = JSON.stringify(session.rows);
    const rejected = [];
    for (const change of [
      file => { file.profileAddress = fixture.second; },
      file => { file.schemaVersion++; },
      file => { file.chainId++; },
      file => { file.workspace.library.folders[0].parentId = file.workspace.library.folders[1].id; },
      file => { file.workspace.library.categoryOrganization.rootCategoryIds.push('missing-folder'); },
      file => { file.workspace.workbenches.activeId = 'workbench:missing'; },
    ]) {
      const file = structuredClone(backup); change(file);
      try { await fixture.previewWorkspaceRestore(JSON.stringify(file), fixture.profile); }
      catch (error) { rejected.push(error.message); }
    }
    if (before !== JSON.stringify(session.rows)) throw Error('Rejected preview changed a row.');
    backup.workspace.workbenches.workbenches[1].content.texts[0].article.title = 'Other copy';
    const plan = await fixture.previewWorkspaceRestore(JSON.stringify(backup), fixture.profile, 'merge');
    await fixture.applyWorkspaceRestore(plan, () => true);
    const merged = JSON.parse(session.rows.workbenches);
    return { rejected, stats: plan.stats, active: merged.activeId, works: merged.workbenches,
      assetCount: Object.keys(JSON.parse(session.rows.library).curatedSnapshots).length };
  });
  assert.equal(result.rejected.length, 6);
  assert.equal(result.assetCount, 1);
  assert.equal(result.active, 'workbench:second');
  assert.equal(result.works.length, 3);
  assert.equal(result.works[1].content.texts[0].article.title, 'Unpublished field notes');
  assert.notEqual(result.works[1].id, result.works[2].id);
  assert.match(result.works[2].name, /imported/);
  assert.equal(result.works[2].content.texts[0].article.title, 'Other copy');
  assert.ok(result.stats.conflicts.length && result.stats.identical.length);
}));

test('export records the captured authored revision; metadata refresh and failed restores preserve it', () => withPage(async page => {
  const results = await page.evaluate(async () => {
    fixture.seed(); await fixture.start();
    const session = fixture.workspaceSession(fixture.profile);
    let file;
    await fixture.exportWorkspaceBackup(fixture.profile, async value => {
      file = value;
      fixture.library().createFolder('After download began');
      await fixture.confirmWorkspaceSaved(fixture.profile);
    });
    const revision = session.lastCommittedWorkspaceRevision;
    const workspace = structuredClone(fixture.library().workspace);
    Object.values(workspace.curatedSnapshots)[0].name = 'Refreshed metadata';
    fixture.library().replaceWorkspace(workspace);
    await fixture.confirmWorkspaceSaved(fixture.profile);
    const plan = await fixture.previewWorkspaceRestore(file, fixture.profile);
    const bytes = JSON.stringify(session.rows), errors = [];
    for (const stop of ['cancel', 'quota']) {
      const put = IDBObjectStore.prototype.put;
      if (stop === 'quota') IDBObjectStore.prototype.put = function(...args) {
        if (this.name === 'records') throw new DOMException('Disk full','QuotaExceededError');
        return put.apply(this,args);
      };
      try { await fixture.applyWorkspaceRestore(plan, () => stop !== 'cancel'); }
      catch (error) { errors.push(error.message); }
      finally { IDBObjectStore.prototype.put = put; }
    }
    return { revision, authored:session.lastCommittedWorkspaceRevision, exported:session.lastExportedRevision,
      errors, intact:JSON.stringify(session.rows) === bytes, status:session.state.status };
  });
  assert.equal(results.authored, results.revision);
  assert.ok(results.exported < results.authored);
  assert.equal(results.errors.length,2); assert.equal(results.intact,true); assert.equal(results.status,'ready');
}));

test('another tab committing after Replace preview invalidates the whole plan', () => withPage(async a => {
  await a.evaluate(async () => {
    fixture.seed(); await fixture.start(); let file;
    await fixture.exportWorkspaceBackup(fixture.profile, value => { file = value; });
    window.plan = await fixture.previewWorkspaceRestore(file, fixture.profile);
  });
  const b = await a.context().newPage(); await b.goto(a.url()); await b.waitForFunction(() => !!window.fixture);
  await b.evaluate(async () => { await fixture.start(); fixture.library().createFolder('Second tab'); await fixture.confirmWorkspaceSaved(fixture.profile); });
  const message = await a.evaluate(async () => {
    try { await fixture.applyWorkspaceRestore(window.plan, () => true); } catch (error) { return error.message; }
  });
  assert.match(message, /changed since preview/);
  await a.reload(); await a.waitForFunction(() => !!window.fixture);
  assert.equal(await a.evaluate(async () => { await fixture.start(); return fixture.library().workspace.folders.at(-1).name; }), 'Second tab');
}));


test('legacy inline artwork exports its selection identity without image bytes and checks quota before writes', () => withPage(async page => {
  const result = await page.evaluate(async () => {
    fixture.seed();
    const library = JSON.parse(localStorage.getItem(fixture.keys[0]));
    const id = library.curatedAssetIds[0], snapshot = library.curatedSnapshots[id];
    const inline = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>');
    snapshot.thumbnailUrl = inline; snapshot.imageGroups[0].resourceId = inline;
    library.curatedImageSelections = [{assetId:id, url:inline}];
    localStorage.setItem(fixture.keys[0], JSON.stringify(library));
    await fixture.start();
    let source;
    await fixture.exportWorkspaceBackup(fixture.profile, value => { source = value; });
    const file = JSON.parse(source);
    const session = fixture.workspaceSession(fixture.profile), before = JSON.stringify(session.rows);
    file.workspace.library.curatedSnapshots[id].name = 'new title'.repeat(500);
    Object.defineProperty(navigator.storage, 'estimate', { value:async () => ({usage:100,quota:100}) });
    let message;
    try { await fixture.previewWorkspaceRestore(JSON.stringify(file), fixture.profile); }
    catch (error) { message = error.message; }
    return { inline:source.includes(inline), identity:file.workspace.library.curatedImageSelections[0].url,
      resource:file.workspace.library.curatedSnapshots[id].imageGroups[0].resourceId,
      message, intact:JSON.stringify(session.rows) === before };
  });
  assert.equal(result.inline,false); assert.match(result.identity,/^ni:\/\/\/sha-256;/);
  assert.equal(result.identity,result.resource); assert.match(result.message,/Insufficient/); assert.ok(result.intact);
}));
