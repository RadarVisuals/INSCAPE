import { assertValidSystemWorkflowDraft, SYSTEM_WORKFLOW_LIMITS } from './domain/systemWorkflowDraft.js';
import { normalizeProfileAddress } from '../library/config.js';
import { textRecoveries } from '../text/textEditRecovery.js';
import { ownerPublicationBaselineKey } from '../profileDocument/storage/ownerPublicationBaselineStorage.js';
import { workbenchLayoutKey } from '../public/ownerSystemWorkflow/workbenchLayoutStorage.js';

export const WORKBENCH_BACKUP_TYPE = 'inscape-private-workbench';
export const WORKBENCH_BACKUP_LIMIT = SYSTEM_WORKFLOW_LIMITS.maxJsonBytes + 2048;
const keys = ['type', 'version', 'createdAt', 'draft'];

export function serializeWorkbenchBackup(draft, createdAt = new Date().toISOString()) {
  const backup = { type: WORKBENCH_BACKUP_TYPE, version: 1, createdAt, draft: assertValidSystemWorkflowDraft(draft) };
  const source = JSON.stringify(backup);
  parseWorkbenchBackup(source, draft.profileAddress);
  return source;
}

export function parseWorkbenchBackup(source, profile) {
  if (typeof source !== 'string' || new TextEncoder().encode(source).length > WORKBENCH_BACKUP_LIMIT)
    throw new Error('This Workbench backup is too large.');
  let value;
  try { value = JSON.parse(source); } catch { throw new Error('Choose a valid INSCAPE Workbench JSON backup.'); }
  if (!value || typeof value !== 'object' || Object.keys(value).length !== keys.length
    || keys.some(key => !Object.hasOwn(value, key)) || value.type !== WORKBENCH_BACKUP_TYPE || value.version !== 1
    || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)))
    throw new Error('This is not a supported INSCAPE Workbench backup.');
  const draft = assertValidSystemWorkflowDraft(value.draft);
  if (draft.profileAddress !== normalizeProfileAddress(profile)) throw new Error('This backup belongs to a different Universal Profile.');
  return { ...value, draft: structuredClone(draft) };
}

export function summarizeWorkbenchBackup(draft) {
  return [
    ['Text', draft.texts?.length || 0], ['Images', draft.imageModules?.length || 0],
    ['Shapes', draft.shapes?.length || 0], ['Displays', (draft.grids.length ? 1 : 0) + (draft.displays?.length || 0)],
    ['Mini apps', draft.miniApps?.length || 0], ['Keeper docks', draft.keeperDocks?.length || 0],
    ['Groups', draft.workbenchGroups?.length || 0],
  ].map(([name, count]) => `${count} ${name}`).join(' · ');
}

// The canonical write is owned by the draft store. These two derived records
// cannot remain authoritative after an explicit replacement. Clear only after
// confirmed persistence and report any cleanup failure separately from saving.
export function restoreWorkbenchBackup(store, backup, options, storage) {
  const profile = store.getProfileAddress();
  if (textRecoveries(store, profile).length || backup.draft.profileAddress !== profile) return { saved: false };
  if (!store.restoreBackup(backup.draft, options)) return { saved: false };
  let warning = null;
  try {
    if (!storage?.removeItem) throw Error('Storage cleanup unavailable');
    storage.removeItem(ownerPublicationBaselineKey(profile));
    storage.removeItem(workbenchLayoutKey(profile));
  } catch {
    warning = 'The draft was restored, but previous layout/publication tracking could not be cleared. Keep this tab open and download a backup before reloading.';
  }
  return { saved: true, warning };
}
