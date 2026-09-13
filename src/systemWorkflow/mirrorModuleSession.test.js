import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemWorkflowDraftStore } from './systemWorkflowDraftStore.js';
import { addMirrorModule, updateMirrorModule } from './mirrorModuleSession.js';
import { buildProfileDocumentV9, countProfileDocumentV9Assets } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { canonicalSerializeProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Serialization.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Reconciliation.js';
import { validateProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Validation.js';
import { createProfileDocumentV9AssetResolver } from '../profileDocument/domain/profileDocumentV9Asset.js';
const profile = '0x1111111111111111111111111111111111111111';
function setup() {
  const data = new Map(); const storage = { getItem: key => data.get(key) ?? null, setItem: (key,v) => data.set(key,v) };
  const store = createSystemWorkflowDraftStore({profileAddress:profile, storage});
  return {store, storage};
}
function asset() {
  const contractAddress = '0x2222222222222222222222222222222222222222', id = `42:${contractAddress}:0x01`;
  return createProfileDocumentV9AssetResolver([{ id, chainId:42, contractAddress, tokenId:'0x01', standard:'LSP8',
    name:'Mirror source', imageUrl:'https://example.com/art.png', imageWidth:1000, imageHeight:1000 }], {compactContentReference:false})(id);
}
test('Mirror settings persist independently; private filtering, public roundtrip and recovery', () => {
  const {store,storage} = setup(); const original = store.getDraft();
  const id = addMirrorModule(store), privateId = addMirrorModule(store);
  let doc = buildProfileDocumentV9({profileAddress:profile, systemWorkflowDraft:store.getDraft()});
  assert.deepEqual(doc.animations, []);
  const settings = store.getDraft().animations[0].settings;
  settings.parameters.rotation.enabled = true; settings.axis = 'horizontal'; settings.flipHorizontal = true;
  assert.equal(updateMirrorModule(store,profile,id,{settings,asset:asset(),visibility:'PUBLIC'}),true);
  const reloaded = createSystemWorkflowDraftStore({profileAddress:profile,storage}).getDraft();
  assert.deepEqual(reloaded.animations[0].settings,settings);
  assert.deepEqual(reloaded.grids, original.grids);
  doc = buildProfileDocumentV9({profileAddress:profile,systemWorkflowDraft:reloaded});
  assert.equal(doc.animations.length,1); assert.equal(countProfileDocumentV9Assets(doc),1);
  const roundtrip = JSON.parse(canonicalSerializeProfileDocumentV9(doc));
  assert.equal(validateProfileDocumentV9(roundtrip).valid,true);
  const restored = reconcileSystemWorkflowDraftFromProfileDocumentV9(roundtrip,reloaded);
  assert.deepEqual(restored.animations[0].settings,settings);
  assert.equal(restored.animations.find(item=>item.id===privateId).visibility,'PRIVATE');
  const bad = structuredClone(doc); bad.animations[0].settings.wallet = 'private';
  assert.equal(validateProfileDocumentV9(bad).valid,false);
  bad.animations = [...doc.animations,...doc.animations]; assert.equal(validateProfileDocumentV9(bad).valid,false);
});
test('failed writes, profile changes and obsolete module updates never succeed', () => {
  const {store,storage} = setup(); const id = addMirrorModule(store);
  const before = store.getDraft(); storage.setItem = () => {throw new Error('quota');};
  assert.equal(updateMirrorModule(store,profile,id,{name:'Changed'}),false);
  assert.deepEqual(store.getDraft(),before);
  assert.equal(updateMirrorModule(store,'0x2222222222222222222222222222222222222222',id,{name:'Changed'}),false);
  assert.equal(updateMirrorModule(store,profile,'mirror:missing',{name:'Changed'}),false);
});
