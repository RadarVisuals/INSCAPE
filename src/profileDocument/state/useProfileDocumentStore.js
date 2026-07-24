import { create } from 'zustand';
import { normalizeProfileAddress } from '../../library/config.js';
import { activateProfileDocumentState, createProfileDocumentState, enterDocumentPreview, exitDocumentPreview, setImportedDocument, setSnapshot } from './profileDocumentState.js';

export const useProfileDocumentStore = create((set) => ({
  ...createProfileDocumentState(),
  activateProfile: (profileAddress) => set((state) => {
    const profile = normalizeProfileAddress(profileAddress);
    return activateProfileDocumentState(state, profile);
  }),
  installSnapshot: (document, fingerprint) => set((state) => normalizeProfileAddress(document?.profile?.address) === state.profileAddress
    ? setSnapshot(state, document, fingerprint)
    : state),
  installImported: (document) => set((state) => state.profileAddress ? setImportedDocument(state, document) : state),
  enterPreview: (source, document) => set((state) => state.profileAddress ? enterDocumentPreview(state, source, document) : state),
  exitPreview: () => set((state) => exitDocumentPreview(state)),
  setError: (error) => set({ error: error ? String(error) : null })
}));
