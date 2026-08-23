import { createEmptySystemWorkflowDraft } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { systemWorkflowDraftKey } from '../../systemWorkflow/systemWorkflowDraftStore.js';

export const OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE = '0x1111111111111111111111111111111111111111';

const REVISION = '226945490a3598b99ddb654f0b15c230348f866e';
const RAW_ROOT = `https://raw.githubusercontent.com/RadarVisuals/INSCAPE/${REVISION}/public`;

const fixtureAsset = ({ token, name, source, width, height, collectionName = 'INSCAPE STUDIES', owned = false, created = false }) => {
  const contractAddress = `0x${String(token).repeat(40)}`;
  const tokenId = `0x0${token}`;
  const id = `42:${contractAddress}:${tokenId}`;
  return Object.freeze({
    id,
    stableAssetId: id,
    chainId: 42,
    contractAddress,
    tokenId,
    standard: 'LSP8',
    name,
    title: name,
    description: 'System Workflow parity review fixture',
    collectionName,
    collection: collectionName,
    imageUrl: `${RAW_ROOT}${source}`,
    thumbnailUrl: `${RAW_ROOT}${source}`,
    originalImageUrl: `${RAW_ROOT}${source}`,
    src: source,
    previewSrc: source,
    imageWidth: width,
    imageHeight: height,
    width,
    height,
    mediaType: 'image',
    placeable: true,
    owned,
    created,
    creators: [{ address: OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE, name: 'RADAR VISUALS' }],
    fieldProvenance: { creators: { source: 'LUKSO INDEXER / LSP4 CREATORS', scope: 'tokenId' } },
    attributes: [],
  });
};

export const OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS = Object.freeze([
  fixtureAsset({ token: 1, name: 'ABYSSAL STUDY', source: '/assets/actors/abyssal_eye/full.webp', width: 2000, height: 2000, owned: true, created: true }),
  fixtureAsset({ token: 2, name: 'SKULL REAPER', source: '/assets/actors/skull_reaper/full.webp', width: 2000, height: 2000, owned: true, created: true }),
  fixtureAsset({ token: 3, name: 'MOUNTAIN SIGNAL I', source: '/assets/stage/mountains/mountain_01.webp', width: 2000, height: 2000, owned: true }),
  fixtureAsset({ token: 4, name: 'MOUNTAIN SIGNAL II', source: '/assets/stage/mountains/mountain_02.webp', width: 2000, height: 2000, owned: true }),
  fixtureAsset({ token: 5, name: 'DIGITAL MEMBRANE', source: '/assets/stage/patterns/digitalblob_top.webp', width: 2000, height: 2000, created: true }),
  fixtureAsset({ token: 6, name: 'ZEBRA FIELD', source: '/assets/stage/patterns/zebra_top.webp', width: 1024, height: 1024, created: true }),
  fixtureAsset({ token: 7, name: 'MOON PURPLE', source: '/assets/stage/backdrops/backdrop_moonpurple.webp', width: 4636, height: 2000, collectionName: 'CHROMATIC FIELDS', owned: true, created: true }),
]);

export const OWNER_SYSTEM_WORKFLOW_REVIEW_CATEGORIES = Object.freeze([
  { id: 'portfolio', name: 'PORTFOLIO', public: true, assetIds: [OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0].id, OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[1].id, OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[6].id] },
  { id: 'field-notes', name: 'FIELD NOTES', public: false, assetIds: [OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[2].id, OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[3].id] },
]);

export const OWNER_SYSTEM_WORKFLOW_REVIEW_ACTIVITY = Object.freeze([
  { id: 'activity-1', type: 'ASSET_RECEIVED', title: 'ASSET RECEIVED', counterparty: 'SIGNAL ARCHIVE', timestamp: '2M', read: false },
  { id: 'activity-2', type: 'NEW_FOLLOWER', title: 'NEW FOLLOWER', counterparty: 'SURFACE UNIT', timestamp: '18M', read: false },
  { id: 'activity-3', type: 'LYX_RECEIVED', title: 'LYX RECEIVED', counterparty: '0.42 LYX', timestamp: '1H', read: true },
  { id: 'activity-4', type: 'ASSET_SENT', title: 'ASSET SENT', counterparty: 'CHROMATIC OFFICE', timestamp: '3H', read: true },
  { id: 'activity-5', type: 'PROFILE_FOLLOWED', title: 'PROFILE FOLLOWED', counterparty: 'SIGNAL ARCHIVE', timestamp: '1D', read: true },
  { id: 'activity-6', type: 'ASSET_PUBLISHED', title: 'ASSET PUBLISHED', counterparty: 'ABYSSAL STUDY', timestamp: '2D', read: true },
  { id: 'activity-7', type: 'LYX_SENT', title: 'LYX SENT', counterparty: '0.18 LYX', timestamp: '4D', read: true },
  { id: 'activity-8', type: 'PROFILE_UNFOLLOWED', title: 'PROFILE UNFOLLOWED', counterparty: 'ARCHIVE NULL', timestamp: '1W', read: true },
]);

export const OWNER_SYSTEM_WORKFLOW_REVIEW_DISCOVERY = Object.freeze([
  { address: '0x8888888888888888888888888888888888888888', name: 'SIGNAL ARCHIVE', role: 'CURATOR', relationship: 'FOLLOWING', group: 'REFERENCES' },
  { address: '0x9999999999999999999999999999999999999999', name: 'SURFACE UNIT', role: 'ARTIST', relationship: 'FOLLOWS YOU', group: 'COLLABORATORS' },
  { address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', name: 'CHROMATIC OFFICE', role: 'PUBLISHER', relationship: 'MUTUAL', group: 'COLLABORATORS' },
]);

const basePlacement = (id, stableAssetId, column, row, columnSpan, rowSpan, layer, crop = null) => ({
  id,
  stableAssetId,
  column,
  row,
  columnSpan,
  rowSpan,
  layer,
  navigationOrder: layer,
  crop,
  frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' },
  transparencyMode: 'AUTO',
  visibility: 'PUBLIC',
  locked: false,
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
});

export function createOwnerSystemWorkflowReviewStorage() {
  const draft = createEmptySystemWorkflowDraft(OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE, { generateId: () => 'home' });
  draft.grids[0].placements = [
    basePlacement('placement-abyssal', OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[0].id, 15, 4, 4, 4, 0),
    basePlacement('placement-mountain-ii', OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[3].id, 20, 9, 5, 3, 1, { x: 0.5, y: 0.5, zoom: 1 }),
  ];
  const values = new Map([[systemWorkflowDraftKey(OWNER_SYSTEM_WORKFLOW_REVIEW_PROFILE), JSON.stringify(draft)]]);
  let writeCount = 0;
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { writeCount += 1; values.set(key, String(value)); globalThis.dispatchEvent?.(new CustomEvent('inscape:review-storage-write', { detail: { writeCount } })); },
    removeItem: (key) => values.delete(key),
    getWriteCount: () => writeCount,
  };
}
