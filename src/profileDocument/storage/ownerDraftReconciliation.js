import { restoreCompositionEditorDocument } from '../../composition/compositionEditorDocument.js';
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

function restoreCanvasDraft(document, entry) {
  // Links were verified against the whole publication, not this canvas alone.
  const { composition, ...content } = canvasDocument(document, entry);
  const draft = createOwnerDraftFromPublishedProfile(content);
  return composition ? { ...draft, composition: restoreCompositionEditorDocument(composition) } : draft;
}

export function openStudioWorkbench(store, id, resolution) {
  const localIds = new Set(store.listWorkbenches().map(item => item.id));
  if (localIds.has(id)) return store.switchWorkbench(id);
  const document = ['RESOLVED', 'STALE'].includes(resolution?.status)
    && matchingDocument(resolution.document, store.getProfileAddress());
  const published = new Map(document ? publishedCanvasEntries(document).map(entry => [entry.id, entry]) : []);
  if (!published.has(id)) throw new Error('This work has no editable canvas in this workspace.');

  // Recover only this work and its missing linked sources, even for cyclic links.
  const required = new Set([id]);
  const recovered = [];
  for (const key of required) {
    const entry = published.get(key);
    if (localIds.has(key) || !entry) continue;
    const { name, introduction, thumbnailCrop } = entry;
    recovered.push({ id: key, name, introduction, thumbnailCrop, draft: restoreCanvasDraft(document, entry) });
    for (const link of entry.content.composition?.links || []) {
      for (const ref of [link.destination, link.source, link.controller, ...Object.values(link.sources || {})]) {
        if (ref?.profileAddress === document.profile.address) required.add(ref.canvasId);
      }
    }
  }
  return store.switchWorkbench(id, { recovered });
}

export function reconcileOwnerDraftWithPublishedProfile({ document: documentInput, profileAddress, store }) {
  const document = matchingDocument(documentInput, profileAddress);
  if (!document) return Object.freeze({ status: 'NO_PUBLISHED_DOCUMENT' });
  const recordState = store?.getRecordState?.();
  if (!['absent', 'valid'].includes(recordState?.status)) {
    return Object.freeze({ status: 'LOCAL_DRAFT_UNAVAILABLE', reason: recordState?.reason,
      issues: recordState?.issues || [], fingerprint: recordState?.fingerprint });
  }
  if (recordState.status === 'valid') return Object.freeze({ status: 'LOCAL_CHANGES_PRESERVED' });
  if (document.canvas) {
    // An existing local draft remains authoritative. Only an absent local record
    // is initialized from the complete public collection, never its first canvas.
    const entries = publishedCanvasEntries(document);
    const first = restoreCanvasDraft(document, entries[0]);
    let collection = createWorkbenchCollection(first);
    const { id, name, introduction, thumbnailCrop } = document.canvas;
    Object.assign(collection.workbenches[0], { id, name, introduction, thumbnailCrop });
    const firstId = document.canvas.id;
    collection.activeId = firstId;
    for (const entry of entries.slice(1)) {
      collection = appendWorkbench(collection, entry.id, entry.name, restoreCanvasDraft(document, entry),
        { introduction: entry.introduction, thumbnailCrop: entry.thumbnailCrop });
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
