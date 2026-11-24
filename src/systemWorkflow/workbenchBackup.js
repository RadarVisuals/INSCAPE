import { assertValidSystemWorkflowDraft } from './domain/systemWorkflowDraft.js';
import { LUKSO_CHAIN_ID, normalizeProfileAddress } from '../library/config.js';
import { textRecoveries } from '../text/textEditRecovery.js';
import { workbenchLayoutKey } from './workbenchLayoutKey.js';
import { normalizeWorkspace } from '../library/storage/libraryWorkspaceStorage.js';
import { imageResourceIdentity } from '../library/data/resolveContentUrl.js';
import { assertArticle, validTextModules } from '../text/domain/article.js';
import { receptionLinkProblems } from '../profileDocument/domain/receptionLinks.js';
import { curatedSnapshot } from '../library/curatedSnapshots.js';
import { validateWorkspaceRows } from '../workspace/validateWorkspaceRows.js';
import { committedWorkspace, recordExport, restoreWorkspaceRows, workspaceSession } from '../workspace/profileWorkspace.js';
import { assetIds, equivalent, mergeBackup, visitCanvasReferences } from './workspaceBackupMerge.js';
import { createWorkbenchCollection, isWorkbenchCollection, assertValidWorkbenchCollection, projectWorkbenchDraft, WORKBENCH_COLLECTION_LIMIT } from './domain/workbenchCollection.js';

export const WORKBENCH_BACKUP_TYPE = 'inscape-private-workbench';
export const WORKBENCH_BACKUP_LIMIT = WORKBENCH_COLLECTION_LIMIT + 2048;
const keys = ['type', 'version', 'createdAt', 'draft'];

export function serializeWorkbenchBackup(draft, createdAt = new Date().toISOString()) {
  const collection = isWorkbenchCollection(draft);
  const backup = { type: WORKBENCH_BACKUP_TYPE, version: collection ? 2 : 1, createdAt,
    draft: collection ? assertValidWorkbenchCollection(draft) : assertValidSystemWorkflowDraft(draft) };
  const source = JSON.stringify(backup);
  parseLegacyWorkbenchBackup(source, draft.profileAddress);
  return source;
}

export function parseLegacyWorkbenchBackup(source, profile) {
  if (typeof source !== 'string' || new TextEncoder().encode(source).length > WORKBENCH_BACKUP_LIMIT)
    throw new Error('This Workbench backup is too large.');
  let value;
  try { value = JSON.parse(source); } catch { throw new Error('Choose a valid INSCAPE Workbench JSON backup.'); }
  if (!value || typeof value !== 'object' || Object.keys(value).length !== keys.length
    || keys.some(key => !Object.hasOwn(value, key)) || value.type !== WORKBENCH_BACKUP_TYPE
    || value.version !== (isWorkbenchCollection(value.draft) ? 2 : 1)
    || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)))
    throw new Error('This is not a supported INSCAPE Workbench backup.');
  const candidate = value.draft;
  const draft = isWorkbenchCollection(candidate) ? assertValidWorkbenchCollection(candidate) : assertValidSystemWorkflowDraft(candidate);
  if (draft.profileAddress !== normalizeProfileAddress(profile)) throw new Error('This backup belongs to a different Universal Profile.');
  return { ...value, draft: structuredClone(draft) };
}

export function summarizeWorkbenchBackup(draft) {
  if (isWorkbenchCollection(draft)) return `${draft.workbenches.length} Workbenches: ${draft.workbenches.map(item => item.name).join(', ')}. Active: ${
    draft.workbenches.find(item => item.id === draft.activeId).name}. ${summarizeWorkbenchBackup(projectWorkbenchDraft(draft))}`;
  return [
    ['Text', draft.texts?.length || 0], ['Images', draft.imageModules?.length || 0],
    ['Shapes', draft.shapes?.length || 0],
    ['Keeper docks', draft.keeperDocks?.length || 0],
    ['Groups', draft.workbenchGroups?.length || 0],
    ['Bento cells', draft.reception?.cells?.length ?? draft.reception?.regions?.length ?? 0],
  ].map(([name, count]) => `${count} ${name}`).join(' · ');
}

// The canonical write is owned by the draft store. Derived layout records
// cannot remain authoritative after an explicit replacement. Clear only after
// confirmed persistence and report any cleanup failure separately from saving.
export function restoreWorkbenchBackup(store, backup, options, storage) {
  const profile = store.getProfileAddress();
  if (textRecoveries(store, profile).length || backup.draft.profileAddress !== profile) return { saved: false };
  const layoutIds = new Set(store.listWorkbenches?.().map(item => item.id));
  try {
    if (!store.restoreBackup(backup.draft, options)) return { saved: false };
  } catch (error) { return { saved: false, error: error.message }; }
  store.listWorkbenches?.().forEach(item => layoutIds.add(item.id));
  const complete = committed => {
    if (!committed) return { saved: false, error: 'Restore is in memory. Keep this tab open and retry the workspace save.' };
    return finishRestore(storage, profile, layoutIds);
  };
  const committed = store.whenCommitted?.() ?? true;
  return typeof committed?.then === 'function' ? committed.then(complete) : complete(committed);
}

function finishRestore(storage, profile, layoutIds) {
  let warning = null;
  try {
    if (!storage?.removeItem) throw Error('Storage cleanup unavailable');
    storage.removeItem(workbenchLayoutKey(profile));
    for (const id of layoutIds) storage.removeItem(workbenchLayoutKey(profile, id));
  } catch {
    warning = 'The draft was restored. Layout could not be cleared; download a backup before reloading.';
  }
  return { saved: true, warning };
}

const workspaceKind = 'inscape-workspace-backup';
const workspaceBackupVersion = 2;
const recordKinds = ['library', 'workbenches', 'textRecovery', 'receptionRecovery'];
const decoded = rows => Object.fromEntries(recordKinds.map(key => [key, JSON.parse(rows[key])]));
const encoded = workspace => Object.fromEntries(recordKinds.map(key => [key, workspace[key] === null ? null : JSON.stringify(workspace[key])]));
function exactRecord(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function validatePortable(workspace, profile) {
  if (!exactRecord(workspace, recordKinds)) throw Error('Incomplete workspace backup.');
  validateWorkspaceRows(encoded(workspace), profile);
  const { library, workbenches, receptionRecovery } = workspace;
  if (receptionRecovery !== null) parseLegacyWorkbenchBackup(JSON.stringify(receptionRecovery), profile);
  if (library !== null) {
    const normalized = normalizeWorkspace(library, profile);
    for (const selections of [library.curatedImageSelections, ...library.folders.map(folder => folder.imageSelections)])
      if (selections?.some(item => /^data:/i.test(item.url))) throw Error('Inline image selections must use portable identifiers.');
    if (!equivalent(normalized, library)) throw Error('Invalid or dangling Library reference.');
    for (const snapshot of Object.values(library.curatedSnapshots || {}))
      if (!equivalent(snapshot, curatedSnapshot(snapshot))) throw Error('Snapshots must use portable media URLs.');
  }
  const recoveryContexts = new Set();
  if (workbenches !== null) {
    const group = assertValidWorkbenchCollection(workbenches);
    if (group.profileAddress !== profile) throw Error('Workbench profile mismatch.');
    const ids = new Set(group.workbenches.map(item => item.id));
    for (const id of ids) recoveryContexts.add(profile + '/' + id);
    if (group.shared.reception) recoveryContexts.add(profile + '/reception');
    const view = { profileAddress: profile, entries: group.workbenches.map(item => ({ id: item.id, draft: projectWorkbenchDraft(group, item.id) })) };
    for (const surface of [group.shared.reception, ...group.workbenches.map(item => item.content.composition)]) {
      const [issue] = receptionLinkProblems(surface, view);
      if (issue) throw Error('Unresolved canvas link ' + issue.id + '. ' + issue.reason);
    }
    visitCanvasReferences(group, ref => { if (!ids.has(ref.canvasId)) throw Error('Dangling Workbench reference: ' + ref.canvasId); });
  }
  const contexts = new Set();
  for (const [context, entries] of workspace.textRecovery || []) {
    if (!recoveryContexts.has(context) || contexts.has(context)) throw Error('Missing or duplicate article recovery context.');
    contexts.add(context);
    const seen = new Set();
    for (const { expected, scope, value } of entries) {
      const key = JSON.stringify([scope.moduleId, scope.gridId, scope.id]);
      if (seen.has(key) || expected.id !== scope.id) throw Error('Invalid pending article reference.');
      seen.add(key);
      if (scope.gridId && scope.moduleId) assertArticle(value);
      else if (!validTextModules([expected]) || !validTextModules([value]) || value.id !== scope.id)
        throw Error('Invalid pending article.');
    }
  }
  return workspace;
}

export function parseWorkbenchBackup(source, profile) {
  let value;
  try { value = JSON.parse(source); } catch { throw Error('Choose a valid INSCAPE Workbench JSON backup.'); }
  if (value?.kind !== workspaceKind) return parseLegacyWorkbenchBackup(source, profile);
  if (value.schemaVersion !== workspaceBackupVersion) throw Error('Unsupported workspace backup schema version: ' + value.schemaVersion);
  const active = normalizeProfileAddress(profile);
  if (!active || value.chainId !== LUKSO_CHAIN_ID || value.profileAddress !== active)
    throw Error('Open the matching workspace for profile ' + value.profileAddress + ' on chain ' + value.chainId + '.');
  if (!exactRecord(value, ['kind','schemaVersion','chainId','profileAddress','exportedAt','workspaceRevision','workspace'])
    || !Number.isSafeInteger(value.workspaceRevision) || value.workspaceRevision < 0
    || typeof value.exportedAt !== 'string' || !Number.isFinite(Date.parse(value.exportedAt))) throw Error('Invalid workspace backup envelope.');
  if (!exactRecord(value.workspace, recordKinds)) throw Error('Incomplete workspace backup.');
  validatePortable(value.workspace, value.profileAddress);
  return value;
}

function serializeWorkspaceRows(profileAddress, rows, workspaceRevision, exportedAt) {
  const workspace = decoded(rows);
  validateWorkspaceRows(rows, profileAddress);
  if (workspace.workbenches && !isWorkbenchCollection(workspace.workbenches))
    workspace.workbenches = createWorkbenchCollection(workspace.workbenches);
  if (workspace.library) {
    workspace.library = normalizeWorkspace(workspace.library, profileAddress);
    const library = workspace.library;
    for (const selections of [library.curatedImageSelections, ...library.folders.map(folder => folder.imageSelections)])
      for (const selection of selections || []) if (/^data:/i.test(selection.url)) selection.url = imageResourceIdentity(selection.url);
    for (const [id, snapshot] of Object.entries(library.curatedSnapshots || {})) {
      for (const group of snapshot.imageGroups) if (/^data:/i.test(group.resourceId)) group.resourceId = imageResourceIdentity(group.resourceId);
      library.curatedSnapshots[id] = curatedSnapshot(snapshot);
    }
  }
  validatePortable(workspace, profileAddress);
  return JSON.stringify({ kind: workspaceKind, schemaVersion: workspaceBackupVersion, chainId: LUKSO_CHAIN_ID, profileAddress,
    exportedAt, workspaceRevision, workspace });
}

export function serializeWorkspaceRecovery(address) {
  const profile = normalizeProfileAddress(address);
  const session = workspaceSession(profile);
  if (!['memory', 'unsaved'].includes(session?.state.status)) throw Error('Workspace recovery is no longer needed.');
  // The envelope identifies the last confirmed base, or zero for a memory-only session.
  return serializeWorkspaceRows(profile, session.rows, session.lastCommittedWorkspaceRevision ?? 0, new Date().toISOString());
}

export async function exportWorkspaceBackup(address, requestDownload) {
  const profileAddress = normalizeProfileAddress(address);
  const base = await committedWorkspace(profileAddress);
  const exportedAt = new Date().toISOString(), workspaceRevision = base.lastCommittedWorkspaceRevision;
  await requestDownload(serializeWorkspaceRows(profileAddress, base.rows, workspaceRevision, exportedAt));
  await recordExport(profileAddress, workspaceRevision, exportedAt);
}

export function workspaceCounts(workspace) {
  const draft = workspace.workbenches;
  return (workspace.library?.folders.length || 0) + ' folders, ' + assetIds(workspace.library).length + ' assets, '
    + (draft?.workbenches?.length ?? (draft ? 1 : 0)) + ' Workbench drafts';
}

async function checkCapacity(rows, before) {
  const bytes = raw => raw === null ? 0 : new Blob([raw]).size;
  const increase = recordKinds.reduce((total, key) => total + bytes(rows[key]) - bytes(before[key]), 0);
  let estimate;
  try { estimate = await globalThis.navigator?.storage?.estimate?.(); }
  catch { /* The atomic write still enforces quota when estimates are unavailable. */ }
  if (estimate && increase > Math.max(0, estimate.quota - estimate.usage)) throw Error('Insufficient device storage for this restore.');
}

export async function previewWorkspaceRestore(source, address, mode = 'replace') {
  if (!['replace','merge'].includes(mode)) throw Error('Choose Replace or Merge.');
  const profile = normalizeProfileAddress(address);
  const backup = parseWorkbenchBackup(source, profile);
  const base = await committedWorkspace(profile);
  const legacy = backup.kind !== workspaceKind;
  // A valid file can repair an unreadable Workbench with explicit Replace.
  const local = Object.fromEntries(recordKinds.map(key => {
    try { return [key, JSON.parse(base.rows[key])]; }
    catch (error) { if (mode === 'replace' && key === 'workbenches') return [key, null]; throw error; }
  }));
  const incoming = legacy ? { library: null, workbenches: backup.draft, receptionRecovery: null, textRecovery: null } : backup.workspace;
  let workspace, stats;
  if (mode === 'merge') ({ workspace, stats } = mergeBackup(local, incoming));
  else workspace = legacy ? { ...local, workbenches: backup.draft } : incoming;
  const blocked = legacy && mode === 'replace' && local.textRecovery
    ? 'Resolve pending text before replacing Workbenches from a legacy file, or choose Merge.' : null;
  const rows = encoded(workspace);
  for (const key of recordKinds) if (equivalent(workspace[key], local[key]) && base.rows[key] !== null && local[key] !== null) rows[key] = base.rows[key];
  if (local.workbenches && !isWorkbenchCollection(local.workbenches) && isWorkbenchCollection(workspace.workbenches)) {
    try {
      if (equivalent(createWorkbenchCollection(local.workbenches), workspace.workbenches)) rows.workbenches = base.rows.workbenches;
    } catch { /* Explicit Replace can repair an invalid local draft. */ }
  }
  if (legacy) {
    validateWorkspaceRows(rows, profile);
    const restored = workspace.workbenches;
    validatePortable({ ...incoming, workbenches: isWorkbenchCollection(restored) ? restored : createWorkbenchCollection(restored) }, profile);
  }
  else if (mode === 'merge') {
    validateWorkspaceRows(rows, profile);
    validatePortable({ ...workspace, library: null }, profile);
  }
  await checkCapacity(rows, base.rows);
  Object.freeze(base.rows);
  return Object.freeze({ profile, mode, base: Object.freeze(base), rows: Object.freeze(rows), stats, legacy, blocked,
    localCounts: workspaceCounts(local), incomingCounts: workspaceCounts(incoming) });
}

export async function applyWorkspaceRestore(plan, isCurrent) {
  await checkCapacity(plan.rows, plan.base.rows);
  if (plan.blocked) throw Error(plan.blocked);
  let warning;
  try { await restoreWorkspaceRows(plan.profile, plan.base, plan.rows, isCurrent, () => {
    if (plan.mode !== 'replace' || plan.rows.workbenches === plan.base.rows.workbenches) return;
    try {
      const restored = JSON.parse(plan.rows.workbenches);
      for (const id of [undefined, 'workbench:main', 'reception', ...(restored?.workbenches || []).map(item => item.id)])
        globalThis.localStorage.removeItem(workbenchLayoutKey(plan.profile, id));
    } catch { warning = 'Workspace restored. Some cached layouts could not be cleared.'; }
  }); }
  catch (error) { if (error.name === 'QuotaExceededError') throw Error('Device storage is full. The current workspace is intact.'); throw error; }
  return warning;
}
