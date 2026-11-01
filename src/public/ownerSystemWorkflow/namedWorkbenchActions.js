import { textRecoveries, TEXT_RECOVERY_MESSAGE } from '../../text/textEditRecovery.js';

const saveFailures = {
  changed: 'Saved work changed elsewhere. Download a backup in Settings before reopening.',
  editor_unavailable: 'This editor cannot save changes.',
  read_failed: 'Storage could not be read. Retry later.',
  invalid: 'Invalid Workbench data or storage limit reached.',
};
export const workbenchSaveError = store => new Error(saveFailures[store.getLastCommitFailure()]
  || 'Could not save the Workbench. Keep it open and retry.');

// This workflow connects the live canvas to collection commands. It owns no
// saved state, form state, camera or module implementation. Every entry point
// uses the same projection and the store remains the final write authority.
export function createNamedWorkbenchActions({ store, projection, flushLayout, busy = false }) {
  const perform = (command, value) => {
    if (!store.hasWriteAccess()) throw new Error(saveFailures.editor_unavailable);
    if (textRecoveries(store, store.getProfileAddress()).length) throw new Error(TEXT_RECOVERY_MESSAGE);
    if (busy) throw new Error('Close publication or finish the preview first.');
    if (!projection.value) throw new Error(projection.error || 'The layout is not ready.');
    if (!flushLayout()) throw new Error('The layout could not be saved. Retry its save first.');
    if (!store[command](value, { workbench: projection.value })) throw workbenchSaveError(store);
  };
  return {
    create(value) {
      perform('createWorkbench', value.trim());
    },
    rename(value) {
      perform('renameWorkbench', value.trim());
    },
    switchTo(id) {
      if (id === store.getWorkbenchId()) return;
      perform('switchWorkbench', id);
    },
    leave() { perform('leaveWorkbench'); },
  };
}
