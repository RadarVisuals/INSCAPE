import { normalizeProfileAddress } from '../../library/config.js';
import { reconcileSystemWorkflowDraftFromProfileDocumentV9 as createOwnerDraftFromPublishedProfile } from '../domain/profileDocumentV9Reconciliation.js';
import { assertValidProfileDocumentV9 } from '../domain/profileDocumentV9Validation.js';
import { canvasDocument, publishedCanvasEntries } from '../domain/publishedCanvases.js';
import { createWorkbenchCollection, appendWorkbench } from '../../systemWorkflow/domain/workbenchCollection.js';

export { reconcileSystemWorkflowDraftFromProfileDocumentV9 as createOwnerDraftFromPublishedProfile } from '../domain/profileDocumentV9Reconciliation.js';

function matchingDocument(documentInput, profileAddress) {
  if (!documentInput) return null;
  try {
    const document = assertValidProfileDocumentV9(documentInput);
    return document.profile.address === normalizeProfileAddress(profileAddress) ? document : null;
  } catch {
    return null;
  }
}

export function reconcileOwnerDraftWithPublishedProfile({ document: documentInput, profileAddress, store }) {
  const document = matchingDocument(documentInput, profileAddress);
  if (!document) return Object.freeze({ status: 'NO_PUBLISHED_DOCUMENT' });
  const recordState = store?.getRecordState?.();
  if (!['absent', 'valid'].includes(recordState?.status)) {
    return Object.freeze({ status: 'LOCAL_DRAFT_UNAVAILABLE', reason: recordState?.reason,
      issues: recordState?.issues || [], fingerprint: recordState?.fingerprint });
  }
  // Existing local work is authoritative. Published Reception is restored only
  // by the explicit, previewed action, with a durable recovery copy.
  if (recordState.status === 'valid') return Object.freeze({ status: 'LOCAL_CHANGES_PRESERVED' });
  if (document.canvas) {
    // An existing local draft remains authoritative. Only an absent local record
    // is initialized from the complete public collection, never its first canvas.
    const entries = publishedCanvasEntries(document);
    let collection = createWorkbenchCollection(createOwnerDraftFromPublishedProfile({ ...canvasDocument(document, entries[0]),
      ...(document.reception ? { reception: document.reception } : {}) }));
    collection.workbenches[0] = { ...collection.workbenches[0], ...document.canvas };
    const firstId = document.canvas.id;
    collection.activeId = firstId;
    for (const entry of entries.slice(1)) {
      collection = appendWorkbench(collection, entry.id, entry.name, createOwnerDraftFromPublishedProfile(canvasDocument(document, entry)));
      Object.assign(collection.workbenches.at(-1), { introduction: entry.introduction, thumbnailCrop: entry.thumbnailCrop });
    }
    collection.activeId = firstId;
    const saved = store.restoreBackup(collection, { expectedGeneration: store.getGeneration() });
    return Object.freeze({ status: saved ? 'HYDRATED_FROM_PUBLISHED' : 'HYDRATION_FAILED' });
  }
  const importedDraft = createOwnerDraftFromPublishedProfile(document);
  const saved = store.commitCompletedOperation(importedDraft, { expectedGeneration: store.getGeneration() });
  return Object.freeze({ status: saved ? 'HYDRATED_FROM_PUBLISHED' : 'HYDRATION_FAILED',
    ...(saved ? {} : { reason: store.getLastCommitFailure?.() }) });
}

