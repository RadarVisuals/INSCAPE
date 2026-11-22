import React from 'react';
import { createRoot } from 'react-dom/client';
import CurationPage from '../src/library/CurationPage.jsx';
import { commitWorkspaceRows, openWorkspaceDatabase } from '../src/workspace/database.js';
import { hydrateWorkspace, confirmWorkspaceSaved, workspaceSession } from '../src/workspace/profileWorkspace.js';
import { libraryWorkspaceKey } from '../src/library/storage/libraryWorkspaceStorage.js';
import { useLibraryStore } from '../src/library/state/useLibraryStore.js';
import { createEmptyWorkspace, createFolder } from '../src/library/domain/libraryWorkspace.js';
import { changeCuratedAssets } from '../src/library/curationStore.js';
import { saveMissingSnapshots } from '../src/library/curatedSnapshots.js';
import { systemWorkflowDraftKey, createSystemWorkflowDraftStore } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import { createWorkbenchCollection, appendWorkbench } from '../src/systemWorkflow/domain/workbenchCollection.js';
import { createEmptySystemWorkflowDraft } from '../src/systemWorkflow/domain/systemWorkflowDraft.js';
import { createReception } from '../src/profileDocument/domain/receptionPresentation.js';
import { createArticle } from '../src/text/domain/article.js';
import { applyWorkspaceRestore, exportWorkspaceBackup, previewWorkspaceRestore, serializeWorkbenchBackup, parseWorkbenchBackup, restoreWorkbenchBackup } from '../src/systemWorkflow/workbenchBackup.js';
import { bindWorkbenchTextRecovery, retainTextRecovery, clearTextRecovery, textRecoveries } from '../src/text/textEditRecovery.js';

const profile = '0x' + 'a'.repeat(40), second = '0x' + 'b'.repeat(40);
const library = () => useLibraryStore.getState();
const wb = () => createSystemWorkflowDraftStore({profileAddress: profile, storage: localStorage});
const keys = [libraryWorkspaceKey(profile), systemWorkflowDraftKey(profile)];
const legacy = () => keys.map(key => localStorage.getItem(key));
function addSnapshots(workspace, count) {
  const records = new Map();
  for (let i = 1; i <= count; i++) {
    const contractAddress = '0x' + i.toString(16).padStart(40, '0'), id = '42:' + contractAddress + ':contract';
    const imageGroups = Array.from({length: 12}, (_, index) => {
      const url = 'https://example.test/' + contractAddress + '/' + 'art'.repeat(55) + index + '.webp';
      return { index, originalImageUrl: url, thumbnailUrl: url, resourceId: url, width: 512, height: 512, fileType: 'image/webp' };
    });
    records.set(id, {id, contractAddress, chainId:42, name:'Prop ' + i, imageGroups});
  }
  const ids = [...records.keys()];
  return saveMissingSnapshots(changeCuratedAssets(workspace, 'add', ids, workspace.folders[0].id), ids, records);
}
function seed() {
  const workspace = addSnapshots(createFolder(createEmptyWorkspace(profile), 'Props'), 1);
  const draft = createEmptySystemWorkflowDraft(profile);
  const article = { ...createArticle(), title: 'Unpublished field notes' };
  draft.texts = [{ id: 'text:author', visibility: 'PRIVATE', article }];
  const collection = appendWorkbench(createWorkbenchCollection(draft), 'workbench:second', 'Second', draft);
  localStorage.setItem(keys[0], JSON.stringify(workspace));
  localStorage.setItem(keys[1], JSON.stringify(collection));
  const buffer = {getProfileAddress: () => profile, getWorkbenchId: () => collection.activeId};
  bindWorkbenchTextRecovery(buffer);
  retainTextRecovery(buffer, {profile, id:'text:author'}, draft.texts[0], {...draft.texts[0], article:{...article, title:'Pending revision'}}, {message:'Interrupted', reason:'write_failed'});
  return legacy();
}
async function start() {
  const session = await hydrateWorkspace(profile);
  if (!session.rows) throw Error(session.state.message);
  library().setProfileAddress(profile);
  const store = wb(), scope = store.getWorkbenchScope();
  return {revision:session.revision, status:session.state.status, count:library().workspace.curatedAssetIds.length,
    folder:library().workspace.folders[0].name, snapshotCount:Object.keys(library().workspace.curatedSnapshots).length,
    active:store.getWorkbenchId(), works:store.listWorkbenches().length, title:store.getDraft().texts[0].article.title,
    recovery:textRecoveries(scope, profile)[0]?.value.article?.title ?? textRecoveries(scope, profile)[0]?.value.title};
}
async function grow() {
  const workspace = addSnapshots(library().workspace, 760);
  if (!library().replaceWorkspace(workspace)) throw Error('Edit rejected.');
  const status = workspaceSession(profile).state.status;
  return { bytes: new Blob([JSON.stringify(workspace)]).size, status, saved:await confirmWorkspaceSaved(profile) };
}
async function restore() {
  const store = wb(), scope = store.getWorkbenchScope();
  for (const entry of textRecoveries(scope, profile)) clearTextRecovery(scope, entry.scope);
  const backup = parseWorkbenchBackup(serializeWorkbenchBackup(store.getBackupSnapshot()), profile);
  backup.draft.workbenches[1].content.texts[0].article.title = 'Restored field notes';
  return await restoreWorkbenchBackup(store, backup, {expectedGeneration:store.getGeneration()}, localStorage);
}
function mount(address = profile) {
  const root = createRoot(document.getElementById('root'));
  root.render(React.createElement(CurationPage, {profileAddress:address, destinations:{}, onBack() { root.unmount(); }}));
}
function seedReceptionRecovery() {
  const draft = createEmptySystemWorkflowDraft(profile);
  draft.reception = createReception();
  draft.reception.branding.name = 'Previous Reception';
  localStorage.setItem('inscape.reception-recovery.v1:' + profile, serializeWorkbenchBackup(draft));
}
function nestedLibrary() {
  const state = library(), ws = state.workspace;
  const parent = ws.folders[0].id;
  const next = createFolder(ws, 'Heads', 10, parent);
  const asset = next.curatedAssetIds[0], images = next.curatedSnapshots[asset].imageGroups;
  const selections = images.slice(0, 2).map(image => ({ assetId: asset, url: image.imageUrl || image.thumbnailUrl }));
  next.curatedImageSelections = selections;
  next.folders.at(-1).assetIds = [asset];
  next.folders.at(-1).imageSelections = selections;
  return state.replaceWorkspace(next);
}
window.fixture = {mount, nestedLibrary, seedReceptionRecovery, exportWorkspaceBackup, previewWorkspaceRestore, applyWorkspaceRestore, commitWorkspaceRows, openWorkspaceDatabase, profile, second, seed, start, grow, restore, legacy, keys, library, hydrateWorkspace, confirmWorkspaceSaved, workspaceSession};
