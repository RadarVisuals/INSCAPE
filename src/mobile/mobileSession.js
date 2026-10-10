import { createMobilePresentation, validMobilePresentation, upgradeMobilePresentation } from './domain/mobilePresentation.js';

export function openMobileModule(store) {
  const draft = store.getDraft();
  const mobile = draft.mobile ? { ...draft.mobile, editor: { open: true } } : createMobilePresentation();
  if (!store.commitCompletedOperation({ ...draft, mobile }, { expectedGeneration: store.getGeneration() })) {
    throw new Error('Mobile could not be saved. Your existing draft is unchanged.');
  }
}
export function updateMobileModule(store, profileAddress, change, historyLabel = 'Edit · Mobile') {
  if (store.getProfileAddress() !== profileAddress) return false;
  const draft = store.getDraft();
  if (!draft?.mobile) return false;
  const mobile = change(historyLabel === null ? draft.mobile : upgradeMobilePresentation(draft.mobile));
  if (!validMobilePresentation(mobile)) throw new TypeError('Invalid Mobile settings');
  return store.commitCompletedOperation({ ...draft, mobile }, { expectedGeneration: store.getGeneration(), historyLabel, recordHistory: historyLabel !== null });
}
