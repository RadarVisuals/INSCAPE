import { normalizeProfileAddress } from '../library/config.js';
import { restoreReception } from '../profileDocument/domain/receptionPresentation.js';
import { serializeWorkbenchBackup, parseWorkbenchBackup } from '../systemWorkflow/workbenchBackup.js';
import { textRecoveries, TEXT_RECOVERY_MESSAGE } from '../text/textEditRecovery.js';
import { workbenchLayoutKey } from '../public/ownerSystemWorkflow/workbenchLayoutStorage.js';
import { createReceptionEditorDocument } from './receptionEditorDocument.js';

export const receptionRecoveryKey = profile => `inscape.reception-recovery.v1:${normalizeProfileAddress(profile)}`;

function available(scope) {
  if (!scope.hasWriteAccess()) throw new Error('Reopen Reception to restore it.');
  scope.checkTransition();
  if (textRecoveries(scope, scope.getProfileAddress()).length) throw new Error(TEXT_RECOVERY_MESSAGE);
}

function prepare(scope, reception) {
  available(scope);
  return Object.freeze({ profileAddress: scope.getProfileAddress(), generation: scope.getGeneration(),
    reception: createReceptionEditorDocument(reception) });
}

export function preparePublishedReception(scope, resolution) {
  if (resolution?.status !== 'RESOLVED') throw new Error('Publication unavailable. Reload your profile.');
  // RESOLVED is owned by the verified publication reader; this action imports
  // only its Reception, which is validated again before any replacement.
  const document = resolution.document;
  if (normalizeProfileAddress(document?.profile?.address) !== scope.getProfileAddress()) throw new Error('This publication belongs to another profile.');
  if (!document.reception) throw new Error('This profile has no published Reception.');
  return prepare(scope, restoreReception(document.reception));
}

export function readReceptionRecovery(storage, profile) {
  try {
    if (!storage?.getItem) throw new Error('Local recovery storage is unavailable.');
    const source = storage.getItem(receptionRecoveryKey(profile));
    if (source === null) return { status: 'absent' };
    const backup = parseWorkbenchBackup(source, profile);
    const reception = backup.draft.shared?.reception || backup.draft.reception;
    if (!reception) throw new Error('This backup has no Reception.');
    return { status: 'ready', value: { reception } };
  } catch (error) { return { status: 'unavailable', message: error.message }; }
}

export function preparePreviousReception(scope, storage) {
  const backup = readReceptionRecovery(storage, scope.getProfileAddress());
  if (backup.status !== 'ready') throw new Error(backup.message || 'No previous Reception on this device.');
  return prepare(scope, backup.value.reception);
}

// Recovery is a local, profile-bound copy, not a second active draft. The normal
// Reception capability owns the replacement and its Undo operation.
export function restorePreparedReception(scope, prepared, storage) {
  available(scope);
  if (prepared.profileAddress !== scope.getProfileAddress() || prepared.generation !== scope.getGeneration())
    throw new Error('Reception changed. Open its restore preview again.');
  const source = serializeWorkbenchBackup(scope.getBackupSnapshot());
  const key = receptionRecoveryKey(prepared.profileAddress);
  try {
    storage.setItem(key, source);
    if (storage.getItem(key) !== source) throw new Error();
  } catch { throw new Error('Reception could not be backed up. Nothing was replaced.'); }
  scope.replaceReception(prepared.reception, prepared.generation);
  try { storage.removeItem(workbenchLayoutKey(prepared.profileAddress, 'reception')); }
  catch { return 'Reception saved. Editor layout cleanup failed; download a backup before reloading.'; }
  return null;
}
