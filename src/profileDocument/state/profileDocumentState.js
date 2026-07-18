import { profileDocumentContentFingerprint } from '../domain/profileDocumentSerialization.js';

export function createProfileDocumentState(snapshot = null) { return { snapshot, snapshotDraftFingerprint: null, imported: null, preview: null, previewSource: null, error: null }; }
export function setSnapshot(state, snapshot, draftFingerprint) { return { ...state, snapshot: structuredClone(snapshot), snapshotDraftFingerprint: draftFingerprint, error: null }; }
export function setImportedDocument(state, imported) { return { ...state, imported: structuredClone(imported), error: null }; }
export function enterDocumentPreview(state, source) {
  const document = source === 'imported' ? state.imported : state.snapshot;
  return document ? { ...state, preview: structuredClone(document), previewSource: source, error: null } : state;
}
export function exitDocumentPreview(state) { return { ...state, preview: null, previewSource: null }; }
export function isSnapshotStale(state, draftDocument) {
  if (!state.snapshot || !state.snapshotDraftFingerprint || !draftDocument) return false;
  return state.snapshotDraftFingerprint !== profileDocumentContentFingerprint(draftDocument);
}
