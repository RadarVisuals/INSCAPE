import { createWorkbenchIndex, validWorkbenchIndex } from './domain/workbenchIndex.js';

export function editWorkbenchIndex(store, profile, expected, next, label = 'Edit Index') {
  if (store.getProfileAddress() !== profile) throw new Error('This profile is no longer active.');
  const draft = store.getDraft();
  if (JSON.stringify(draft.workbenchIndex) !== JSON.stringify(expected)) throw new Error('The Index changed. Try again.');
  if (!validWorkbenchIndex(next, draft)) throw new Error('Check the Index name, view and window settings.');
  if (!store.commitCompletedOperation({ ...draft, workbenchIndex: next }, {
    expectedGeneration: store.getGeneration(), historyLabel: label,
  })) throw new Error('The Index could not be saved. Your saved work is unchanged.');
}

export function openWorkbenchIndex(store, profile) {
  const current = store.getDraft().workbenchIndex;
  editWorkbenchIndex(store, profile, current, { ...(current || createWorkbenchIndex()), open: true }, 'Open Index');
}
