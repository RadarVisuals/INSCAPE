import { normalizeWorkspace } from '../library/storage/libraryWorkspaceStorage.js';
import { createSystemWorkflowDraftStore } from '../systemWorkflow/systemWorkflowDraftStore.js';
import { parseLegacyWorkbenchBackup } from '../systemWorkflow/workbenchBackup.js';

export { pendingProfileText } from '../text/textEditRecovery.js';

export function validateWorkspaceRows(rows, profile, verified = false) {
  if (rows.library !== null) {
    const source = JSON.parse(rows.library);
    const normalized = normalizeWorkspace(source, profile);
    // The normal reader tolerates malformed members. Never promote a migration
    // which would silently hide authored data in that reader.
    for (const field of ['folders', 'favorites', 'curatedAssetIds', 'curatedImageSelections', 'curatedSnapshots', 'categoryOrganization']) {
      if (source[field] !== undefined && !preserves(source[field], normalized[field] ?? {}))
        throw Error('Invalid saved Library ' + field + '.');
    }
  }
  // Once migrated, the Workbench owns its corrupt-record and backup restore UI.
  if (!verified && rows.workbenches !== null) {
    const store = createSystemWorkflowDraftStore({ profileAddress: profile, storage: { getItem: () => rows.workbenches } });
    if (store.getRecordState().status !== 'valid') throw Error('Invalid saved Workbench or article draft.');
  }
  if (rows.receptionRecovery !== null) parseLegacyWorkbenchBackup(rows.receptionRecovery, profile);
  if (rows.textRecovery !== null) {
    const contexts = JSON.parse(rows.textRecovery);
    if (!Array.isArray(contexts) || contexts.some(pair => !Array.isArray(pair) || pair.length !== 2
      || typeof pair[0] !== 'string' || !pair[0].startsWith(profile + '/') || !Array.isArray(pair[1])
      || pair[1].some(entry => entry?.scope?.profile !== profile || !entry.scope.id
        || !entry.expected || !Object.hasOwn(entry, 'value') || typeof entry.failure?.message !== 'string'))) throw Error('Invalid text recovery record.');
  }
}
// Older valid rows may omit defaults that the current reader supplies.
function preserves(source, normalized) {
  if (source === normalized) return true;
  if (!source || !normalized || typeof source !== 'object' || typeof normalized !== 'object') return false;
  if (Array.isArray(source) !== Array.isArray(normalized) || Array.isArray(source) && source.length !== normalized.length) return false;
  return Object.keys(source).every(key => Object.hasOwn(normalized, key) && preserves(source[key], normalized[key]));
}
