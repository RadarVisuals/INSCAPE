import { normalizeProfileAddress } from '../library/config.js';
import { projectLatticeProductionPublication } from '../lattice/domain/latticeProductionAdapter.js';
import { PROFILE_DOCUMENT_NETWORK, PROFILE_DOCUMENT_TYPE, PROFILE_DOCUMENT_VERSION_8 } from '../profileDocument/domain/constants.js';
import { parsePublishedAssetUrl, resolvePublishedAssetUrl } from '../profileDocument/domain/publishedAssetUrl.js';
import { assertValidProfileDocument } from '../profileDocument/domain/profileDocumentValidation.js';

export const OWNER_LATTICE_PREVIEW_MEDIA_TIMEOUT = 8_000;

export function ownerLatticePreviewEntryMediaUrls(previewDocument) {
  const entryTable = previewDocument?.lattice?.tables?.find(({ coordinate }) => coordinate?.x === 0 && coordinate?.y === 0);
  return [...new Set((entryTable?.placements || [])
    .map(({ asset }) => resolvePublishedAssetUrl(asset?.media?.url))
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

export async function preloadOwnerLatticePreviewEntryMedia(previewDocument, {
  ImageConstructor = globalThis.Image,
  setTimeout: schedule = globalThis.setTimeout,
  clearTimeout: cancel = globalThis.clearTimeout,
  timeoutMs = OWNER_LATTICE_PREVIEW_MEDIA_TIMEOUT,
} = {}) {
  const sources = ownerLatticePreviewEntryMediaUrls(previewDocument);
  if (!sources.length || typeof ImageConstructor !== 'function') return;
  let timer;
  await Promise.race([
    Promise.all(sources.map((source) => decodePreviewMedia(source, ImageConstructor))),
    new Promise((resolve) => { timer = schedule(resolve, timeoutMs); }),
  ]);
  cancel(timer);
}

export function buildOwnerLatticePreviewDocument({ activeActorId, assetRecords, latticeDraft, profile, profileAddress, stageId }) {
  const address = normalizeProfileAddress(profileAddress);
  if (!address || latticeDraft?.profileAddress !== address) throw new TypeError('The lattice draft must match the preview profile authority');
  const name = typeof profile?.name === 'string' ? profile.name.trim().slice(0, 80) : '';
  const avatarUrl = parsePublishedAssetUrl(typeof profile?.avatarUrl === 'string' ? profile.avatarUrl.trim().slice(0, 2048) : '')?.value;
  return assertValidProfileDocument({
    documentType: PROFILE_DOCUMENT_TYPE, version: PROFILE_DOCUMENT_VERSION_8,
    documentId: `profile:${address}`, revision: 1, createdAt: new Date(0).toISOString(), exportedAt: new Date(0).toISOString(),
    network: { ...PROFILE_DOCUMENT_NETWORK }, profile: { address, cachedIdentity: { address, ...(name ? { name } : {}), ...(avatarUrl ? { avatarUrl } : {}) } },
    presentation: { keeperId: activeActorId || 'abyssal_eye', stageId: stageId || 'moonpurple', avatarShape: 'square',
      visitorNavigation: { showCategories: true, showCreations: false }, environment: { type: 'illustrated', shaderId: 'neural-field' },
      systemModules: [{ id: 'identity', visible: true, placement: null, startOpen: false, windowGeometry: null }, { id: 'signals', visible: true, placement: null, startOpen: false, windowGeometry: null }],
      signals: { notifications: true, speech: true, visualEffects: true, audio: false } },
    spaces: [], canvasObjects: [], metadata: {},
    lattice: projectLatticeProductionPublication(latticeDraft, assetRecords || [], { lastPublished: new Date(0).toISOString() }),
  });
}
