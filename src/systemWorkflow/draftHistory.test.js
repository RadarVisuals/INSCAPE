import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from './systemWorkflowDraftStore.js';
import { addMiniApp, saveMiniApp } from '../miniApps/miniAppSession.js';
import { createSystemWorkflowAuthoringSession } from './systemWorkflowAuthoringSession.js';
import { createArticle } from '../text/domain/article.js';
import { draftChanges, applyDraftChanges } from './draftHistory.js';
const profile = '0x1111111111111111111111111111111111111111';
function setup() {
  const values = new Map(), storage = { getItem: k => values.get(k) ?? null, setItem: (k, v) => values.set(k, v) };
  return { storage, values, store: createSystemWorkflowDraftStore({ profileAddress: profile, storage }) };
}
function rename(store, name) {
  const current = store.getDraft().miniApps[0];
  return saveMiniApp(store, profile, current, { ...current, name });
}

test('chronological undo crosses Mini app and Display and persists successful restoration', () => {
  const { store, storage } = setup(); addMiniApp(store, profile);
  const before = store.getDraft();
  rename(store, 'My app');
  const session = createSystemWorkflowAuthoringSession({ store }); session.createGrid();
  assert.equal(store.undo(), true); assert.equal(store.getDraft().grids.length, before.grids.length);
  assert.ok(session.getState().draft.grids.some(grid => grid.id === session.getState().selectedGridId));
  assert.equal(store.getDraft().miniApps[0].name, 'My app');
  assert.equal(store.undo(), true); assert.deepEqual(store.getDraft(), before);
  assert.equal(store.redo(), true); assert.equal(store.getDraft().miniApps[0].name, 'My app');
  assert.equal(store.redo(), true); assert.equal(store.getDraft().grids.length, before.grids.length + 1);
  assert.deepEqual(createSystemWorkflowDraftStore({ profileAddress: profile, storage }).getDraft(), store.getDraft());
});

test('preview navigation is not an undo step and does not prevent undoing module creation', () => {
  const { store } = setup();
  const session = createSystemWorkflowAuthoringSession({ store });
  session.createGrid();
  addMiniApp(store, profile);
  session.selectGrid(store.getDraft().grids[0].id);
  assert.equal(store.undo(), true); assert.equal(store.getDraft().miniApps, undefined);
  assert.equal(store.redo(), true); assert.equal(store.getDraft().miniApps.length, 1);
});

test('failed writes and external edits preserve both draft and history', () => {
  const { store, storage, values } = setup(); addMiniApp(store, profile);
  const before = store.getDraft(), history = store.getHistory(), setItem = storage.setItem;
  storage.setItem = () => { throw new Error('quota'); };
  assert.equal(store.undo(), false); assert.deepEqual(store.getDraft(), before); assert.deepEqual(store.getHistory(), history);
  storage.setItem = setItem;
  values.set([...values.keys()][0], '{}'); assert.equal(store.undo(), false);
  assert.deepEqual(store.getDraft(), before); assert.deepEqual(store.getHistory(), history);
});

test('a new edit clears redo; profile history is isolated and reload clears it', () => {
  const { store } = setup(); addMiniApp(store, profile); rename(store, 'First');
  store.undo(); rename(store, 'Replacement');
  assert.equal(store.redo(), false);
  store.setProfileAddress('0x2222222222222222222222222222222222222222'); assert.equal(store.undo(), false);
  store.setProfileAddress(profile); assert.ok(store.getHistory().undo); store.reload(); assert.equal(store.undo(), false);
});

test('continuous updates group into one gesture and cannot cross an undo boundary', () => {
  const { store } = setup(); addMiniApp(store, profile);
  const before = store.getDraft(); store.beginHistoryGroup();
  for (const name of ['First', 'Second', 'Final']) rename(store, name);
  store.endHistoryGroup(); assert.equal(store.undo(), true); assert.deepEqual(store.getDraft(), before);
  assert.equal(store.redo(), true); assert.equal(store.getDraft().miniApps[0].name, 'Final');
});

test('history preserves deletion, array replacement and detached values with shared branches', () => {
  const before={ items:[{id:'a',name:'First',optional:true},{id:'b',name:'Second'}], article:{content:['a','b']} };
  const after={ items:[{id:'a',name:'Changed'},before.items[1]], article:{content:['a','c']} };
  const changes=draftChanges(before,after);
  assert.deepEqual(applyDraftChanges(before,changes,'redo'),after);
  assert.deepEqual(applyDraftChanges(after,changes,'undo'),before);
  after.article.content.push('later');
  assert.deepEqual(applyDraftChanges(before,changes,'redo').article.content,['a','c']);
  assert.equal(applyDraftChanges({ ...before,items:[{id:'a',name:'External'},before.items[1]] },changes,'redo'),null);
});

test('large article history stays bounded after grouped entry growth and retains complete undo/redo', () => {
  const {store}=setup();
  const initial=store.getDraft();
  initial.texts=[{id:'text:history',visibility:'PRIVATE',article:createArticle()}];
  assert.equal(store.commitCompletedOperation(initial,{expectedGeneration:store.getGeneration()}),true);
  store.reload();
  for(let edit=0;edit<30;edit++) {
    store.beginHistoryGroup();
    for(const size of [100,150000]) {
      const draft=store.getDraft();
      draft.texts[0].article.content={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:String(edit%10).repeat(size)}]}]};
      assert.equal(store.commitCompletedOperation(draft,{expectedGeneration:store.getGeneration()}),true);
    }
    store.endHistoryGroup();
  }
  const final=store.getDraft();
  let count=0;
  while(store.undo()) count++;
  assert.ok(count>=10 && count<=13,`4 MB must bound large grouped edits; retained ${count}`);
  for(let i=0;i<count;i++) assert.equal(store.redo(),true);
  assert.deepEqual(store.getDraft(),final);
});
