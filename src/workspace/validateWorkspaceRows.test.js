import assert from 'node:assert/strict';
import test from 'node:test';
import { validateWorkspaceRows } from './validateWorkspaceRows.js';
import { createEmptyWorkspace } from '../library/domain/libraryWorkspace.js';
import { createEmptySystemWorkflowDraft } from '../systemWorkflow/domain/systemWorkflowDraft.js';
import { curatedSnapshot } from '../library/curatedSnapshots.js';

const profile = '0x' + 'a'.repeat(40);
const empty = { library:null, workbenches:null, textRecovery:null, receptionRecovery:null };

test('migration refuses silently dropped folder membership and a mismatched Workbench profile', () => {
  const ws = createEmptyWorkspace(profile);
  assert.doesNotThrow(() => validateWorkspaceRows({...empty, library:JSON.stringify(ws)},profile));
  ws.folders.push({id:'props',name:'Props',assetIds:[1],public:false,createdAt:1,updatedAt:1});
  assert.throws(() => validateWorkspaceRows({...empty,library:JSON.stringify(ws)},profile),/Library folders/);
  const wrong = createEmptySystemWorkflowDraft('0x' + 'b'.repeat(40));
  assert.throws(() => validateWorkspaceRows({...empty,workbenches:JSON.stringify(wrong)},profile),/Workbench/);
});

test('new display snapshots carry URL references and exclude inline image bytes', () => {
  const inline = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0"/></svg>').toString('base64');
  const external = 'https://example.test/thumb.webp';
  const record = curatedSnapshot({id:'42:' + profile + ':contract',chainId:42,contractAddress:profile,
    thumbnailUrl:external,originalImageUrl:inline,imageGroups:[{resourceId:inline,imageUrl:inline,variants:[{url:inline}]}]});
  assert.equal(record.thumbnailUrl,external);
  assert.equal(record.originalImageUrl,null);
  assert.equal(record.imageGroups[0].resourceId,null);
  assert.ok(!JSON.stringify(record).includes('base64'));
});
