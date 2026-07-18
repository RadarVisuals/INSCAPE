import { create } from 'zustand';
import { createProfileDocumentState, enterDocumentPreview, exitDocumentPreview, setImportedDocument, setSnapshot } from './profileDocumentState.js';

export const useProfileDocumentStore = create((set) => ({
  ...createProfileDocumentState(),
  installSnapshot: (document, fingerprint) => set((state) => setSnapshot(state, document, fingerprint)),
  installImported: (document) => set((state) => setImportedDocument(state, document)),
  enterPreview: (source) => set((state) => enterDocumentPreview(state, source)),
  exitPreview: () => set((state) => exitDocumentPreview(state)),
  setError: (error) => set({ error: error ? String(error) : null })
}));
