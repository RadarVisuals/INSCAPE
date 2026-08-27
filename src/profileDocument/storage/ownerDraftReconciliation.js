import { normalizeProfileAddress } from '../../library/config.js';
import {
  SYSTEM_WORKFLOW_DRAFT_VERSION,
  assertValidSystemWorkflowDraft,
} from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { assertValidProfileDocumentV9 } from '../domain/profileDocumentV9Validation.js';
import {
  loadOwnerPublicationBaseline,
  saveOwnerPublicationBaseline,
} from './ownerPublicationBaselineStorage.js';
import { createSystemWorkflowDraftStore } from '../../systemWorkflow/systemWorkflowDraftStore.js';

export function systemWorkflowDraftFingerprint(draftInput) {
  const draft = assertValidSystemWorkflowDraft(draftInput);
  const canonicalize = (value) => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  };
  const text = JSON.stringify(canonicalize(draft));
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `draft-v1:${text.length}:${(first >>> 0).toString(16).padStart(8, '0')}:${(second >>> 0).toString(16).padStart(8, '0')}`;
}

export function createOwnerDraftFromPublishedProfile(documentInput) {
  const document = assertValidProfileDocumentV9(documentInput);
  const draft = {
    profileAddress: document.profile.address,
    draftVersion: SYSTEM_WORKFLOW_DRAFT_VERSION,
    artboard: structuredClone(document.artboard),
    geometry: structuredClone(document.geometry),
    appearance: structuredClone(document.appearance),
    identityPresentation: {
      alias: document.identityPresentation.alias,
      avatar: {
        mode: document.identityPresentation.avatar.mode,
        stableAssetId: document.identityPresentation.avatar.asset?.stableAssetId || null,
        shape: document.identityPresentation.avatar.shape,
      },
      bio: structuredClone(document.identityPresentation.bio),
      tags: structuredClone(document.identityPresentation.tags),
      dossierSurface: document.identityPresentation.dossierSurface,
      visibility: structuredClone(document.identityPresentation.visibility),
    },
    grids: document.grids.map((grid) => ({
      id: grid.id,
      title: grid.title,
      subtitle: grid.subtitle,
      visibility: grid.visibility,
      labelVisible: grid.labelVisible,
      labelAnchor: grid.labelAnchor,
      labelOffset: structuredClone(grid.labelOffset),
      placements: grid.placements.map(({ asset, ...placement }) => ({
        ...structuredClone(placement),
        stableAssetId: asset.stableAssetId,
        locked: false,
      })),
    })),
  };
  return assertValidSystemWorkflowDraft(draft);
}

function matchingDocument(documentInput, profileAddress) {
  if (!documentInput) return null;
  try {
    const document = assertValidProfileDocumentV9(documentInput);
    return document.profile.address === normalizeProfileAddress(profileAddress) ? document : null;
  } catch {
    return null;
  }
}

export function reconcileOwnerDraftWithPublishedProfile({ document: documentInput, profileAddress, storage, store }) {
  const document = matchingDocument(documentInput, profileAddress);
  if (!document) return Object.freeze({ status: 'NO_PUBLISHED_DOCUMENT' });
  const recordState = store?.getRecordState?.();
  if (!['absent', 'valid'].includes(recordState?.status)) {
    return Object.freeze({ status: 'LOCAL_DRAFT_UNAVAILABLE' });
  }
  const localDraft = store.getDraft();
  const localFingerprint = systemWorkflowDraftFingerprint(localDraft);
  const importedDraft = createOwnerDraftFromPublishedProfile(document);
  const publishedFingerprint = systemWorkflowDraftFingerprint(importedDraft);
  const baseline = loadOwnerPublicationBaseline(storage, profileAddress);
  if (baseline?.publishedFingerprint === publishedFingerprint) {
    return Object.freeze({ status: 'LOCAL_DRAFT_CURRENT', publishedFingerprint });
  }
  if (baseline && baseline.localFingerprint !== localFingerprint) {
    return Object.freeze({ status: 'LOCAL_CHANGES_PRESERVED', publishedFingerprint });
  }
  if (!store.commitCompletedOperation(importedDraft, { expectedGeneration: store.getGeneration() })) {
    return Object.freeze({ status: 'HYDRATION_FAILED', publishedFingerprint });
  }
  const importedFingerprint = systemWorkflowDraftFingerprint(importedDraft);
  const baselineSaved = saveOwnerPublicationBaseline(storage, profileAddress, {
    publishedFingerprint,
    localFingerprint: importedFingerprint,
  });
  return Object.freeze({
    status: baselineSaved ? 'HYDRATED_FROM_PUBLISHED' : 'HYDRATED_WITHOUT_BASELINE',
    publishedFingerprint,
  });
}

export function reconcileStoredOwnerDraftWithPublishedProfile({ document, profileAddress, storage }) {
  const store = createSystemWorkflowDraftStore({ profileAddress, storage });
  return reconcileOwnerDraftWithPublishedProfile({ document, profileAddress, storage, store });
}

export function recordOwnerPublicationBaseline({ document: documentInput, draft, profileAddress, storage }) {
  const document = matchingDocument(documentInput, profileAddress);
  if (!document) return false;
  return saveOwnerPublicationBaseline(storage, profileAddress, {
    publishedFingerprint: systemWorkflowDraftFingerprint(createOwnerDraftFromPublishedProfile(document)),
    localFingerprint: systemWorkflowDraftFingerprint(draft),
  });
}
