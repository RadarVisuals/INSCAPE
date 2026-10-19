import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore, systemWorkflowDraftKey } from './systemWorkflowDraftStore.js';
import { createArticle } from '../text/domain/article.js';
import { saveTextModuleResult } from '../text/textSession.js';
const profile = `0x${'1'.repeat(40)}`;

test('normalization detaches accepted data and does not add a cover Grid to the caller', () => {
  const records = new Map();
  const storage = { getItem: key => records.get(key) ?? null, setItem: (key,value) => records.set(key,value) };
  const store = createSystemWorkflowDraftStore({ profileAddress:profile, storage });
  const candidate = store.getDraft();
  candidate.grids = candidate.grids.filter(grid => grid.id !== 'grid:world-cover');
  candidate.texts = [{id:'text:first',visibility:'PRIVATE',article:createArticle('Accepted')}];
  const submitted = structuredClone(candidate);
  assert.ok(store.commitCompletedOperation(candidate,{expectedGeneration:store.getGeneration()}));
  assert.deepEqual(candidate,submitted,'normalization cannot mutate the submitted value');
  const accepted = JSON.stringify(store.getSnapshot());
  candidate.texts[0].article.title='Outside mutation'; candidate.grids[0].title='Outside mutation';
  assert.equal(JSON.stringify(store.getSnapshot()),accepted);
  assert.equal(storage.getItem(systemWorkflowDraftKey(profile)),accepted);
  assert.throws(() => { store.getSnapshot().texts[0].article.title='Frozen mutation'; });
});

test('successive shared-snapshot Text edits preserve siblings, validate changes, and keep failures out of history', () => {
  const records = new Map(); let broken=false;
  const storage = {getItem:key=>records.get(key)??null,setItem:(key,value)=>{if(broken)throw Error('full');records.set(key,value);}};
  const store=createSystemWorkflowDraftStore({profileAddress:profile,storage});
  const initial=store.getDraft();
  initial.texts=Array.from({length:12},(_,i)=>({id:`text:article-${i}`,visibility:'PRIVATE',article:createArticle(`Article ${i}`)}));
  assert.ok(store.commitCompletedOperation(initial,{expectedGeneration:store.getGeneration()})); store.reload();
  const original=structuredClone(store.getSnapshot());
  for(let i=0;i<8;i++) {
    const expected=store.getSnapshot().texts[0];
    assert.ok(saveTextModuleResult(store,profile,expected,{...expected,article:{...expected.article,title:`Edit ${i}`}}).saved);
  }
  assert.deepEqual(store.getSnapshot().texts.slice(1),original.texts.slice(1));
  const accepted=JSON.stringify(store.getSnapshot()), history=store.getHistory(), expected=store.getSnapshot().texts[0];
  const invalid={...expected,article:{...expected.article,content:{type:'doc',content:[{type:'script'}]}}};
  assert.equal(saveTextModuleResult(store,profile,expected,invalid).reason,'invalid');
  broken=true;
  assert.equal(saveTextModuleResult(store,profile,expected,{...expected,article:{...expected.article,title:'Failed'}}).reason,'write_failed');
  assert.equal(store.undo(),false); assert.deepEqual(store.getHistory(),history);
  assert.equal(storage.getItem(systemWorkflowDraftKey(profile)),accepted);
  assert.equal(JSON.stringify(store.getSnapshot()),accepted);
  broken=false; assert.ok(store.undo()); assert.ok(store.redo());
  assert.equal(JSON.stringify(store.getSnapshot()),accepted);
  assert.deepEqual(createSystemWorkflowDraftStore({profileAddress:profile,storage}).getSnapshot(),store.getSnapshot());
});
