import { buildProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Builder.js';
import { assertValidProfileDocumentV9 } from '../profileDocument/domain/profileDocumentV9Validation.js';
import { resolvePublishedAssetUrl } from '../profileDocument/domain/publishedAssetUrl.js';

export const OWNER_SYSTEM_WORKFLOW_PREVIEW_MEDIA_TIMEOUT = 8_000;

export function profileDocumentV9EntryGrid(documentInput) {
  const document = assertValidProfileDocumentV9(documentInput);
  return document.grids[0];
}

export function ownerSystemWorkflowPreviewEntryMediaUrls(previewDocument) {
  const entryGrid = profileDocumentV9EntryGrid(previewDocument);
  return [...new Set(entryGrid.placements
    .map(({ asset }) => resolvePublishedAssetUrl(asset.media.url))
    .filter(Boolean))];
}

function decodePreviewMedia(source, ImageConstructor) {
  return new Promise((resolve) => {
    const image = new ImageConstructor();
    const finish = () => resolve();
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.onerror = finish;
    image.onload = finish;
    image.src = source;
    if (typeof image.decode === 'function') image.decode().then(finish, finish);
  });
}

export async function preloadOwnerSystemWorkflowPreviewEntryMedia(previewDocument, {
  ImageConstructor = globalThis.Image,
  setTimeout: schedule = globalThis.setTimeout,
  clearTimeout: cancel = globalThis.clearTimeout,
  timeoutMs = OWNER_SYSTEM_WORKFLOW_PREVIEW_MEDIA_TIMEOUT,
} = {}) {
  const sources = ownerSystemWorkflowPreviewEntryMediaUrls(previewDocument);
  if (!sources.length || typeof ImageConstructor !== 'function') return;
  let timer;
  await Promise.race([
    Promise.all(sources.map((source) => decodePreviewMedia(source, ImageConstructor))),
    new Promise((resolve) => { timer = schedule(resolve, timeoutMs); }),
  ]);
  if (timer !== undefined) cancel(timer);
}

export function buildOwnerSystemWorkflowPreviewDocument({
  assetRecords,
  createdAt = 0,
  exportedAt = createdAt,
  profile,
  profileAddress,
  revision = 1,
  systemWorkflowDraft,
}) {
  return buildProfileDocumentV9({
    assetRecords,
    createdAt,
    exportedAt,
    profileAddress,
    profileIdentity: profile,
    revision,
    systemWorkflowDraft,
  });
}

export function buildOwnerSystemWorkflowPublicationDocument({ previousDocument = null, ...input }) {
  const previous = previousDocument === null ? null : assertValidProfileDocumentV9(previousDocument);
  if (previous && previous.profile.address !== input.profileAddress) {
    throw new TypeError('The previous publication belongs to a different profile');
  }
  const exportedAt = input.exportedAt ?? new Date();
  return buildOwnerSystemWorkflowPreviewDocument({
    ...input,
    createdAt: previous?.createdAt ?? exportedAt,
    exportedAt,
    revision: previous ? previous.revision + 1 : 1,
  });
}
