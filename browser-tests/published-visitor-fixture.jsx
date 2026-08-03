import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import PublishedProfileDocumentPreview from '../src/profileDocument/components/PublishedProfileDocumentPreview.jsx';
import ProfileDiscoveryBoundary from '../src/profileDiscovery/ProfileDiscoveryBoundary.jsx';
import { buildProfileDocumentV3, buildProfileDocumentV8 } from '../src/profileDocument/domain/profileDocumentBuilder.js';
import { createEmptyLatticeProductionDraft, LATTICE_PRODUCTION_VISIBILITY } from '../src/lattice/domain/latticeProductionDraft.js';
import '../src/index.css';
import '../src/public/moduleGrid.css';
import '../src/library/collection.css';
import '../src/profileDocument/profileDocument.css';
import '../src/public/canvasObjects.css';

export const PROFILE_A = '0x1111111111111111111111111111111111111111';
export const PROFILE_B = '0x2222222222222222222222222222222222222222';
const ASSET_CONTRACT = '0x3333333333333333333333333333333333333333';
const CID = 'QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQw';

const assetId = (tokenId) => `42:${ASSET_CONTRACT}:${tokenId}`;
const assetRecord = ({ name, tokenId, url }) => ({
  id: assetId(tokenId), chainId: 42, contractAddress: ASSET_CONTRACT, tokenId, standard: 'LSP8', name,
  description: `${name} public fixture description`, collectionName: 'Published fixture collection',
  imageUrl: url, thumbnailUrl: null, originalImageUrl: url, imageWidth: 1600, imageHeight: 900,
  creators: [], attributes: [],
});
const placement = ({ id, tokenId, column, row, navigationOrder }) => ({
  id, stableAssetId: assetId(tokenId), column, row, columnSpan: 8, rowSpan: 7, layer: navigationOrder,
  navigationOrder, crop: null, frameId: 'NONE',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
  visibility: LATTICE_PRODUCTION_VISIBILITY.PUBLIC, locked: true,
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
});

function baseInput(address, suffix, assets) {
  return {
    profileAddress: address,
    workspace: { version: 8, profileAddress: address, favorites: [], folders: [], canvas: { launchers: [], objects: [] } },
    assets,
    publicPresentation: { keeperId: 'skull_reaper', stageId: 'void' },
    signalSettings: { notifications: true, speech: true, visualEffects: true, audio: false },
    profileIdentity: { name: `${suffix} Visitor Fixture`, avatarUrl: `https://published-images.invalid/avatar-${suffix}.png` },
    documentId: `profile:${address}`, revision: 1, createdAt: 1, exportedAt: 2,
  };
}

function createCanonicalDocument(address, suffix, artworkUrl) {
  const assets = [
    assetRecord({ name: `${suffix} Artwork 1`, tokenId: '0x01', url: artworkUrl }),
    assetRecord({ name: `${suffix} IPFS Artwork`, tokenId: '0x02', url: `ipfs://${CID}/space-${suffix}.png` }),
  ];
  const latticeDraft = createEmptyLatticeProductionDraft(address);
  latticeDraft.tables.forEach((table, index) => {
    table.title = `${suffix} Table ${index + 1}`;
    table.subtitle = `Canonical slot ${index + 1}`;
  });
  latticeDraft.tables[4].placements = [
    placement({ id: `art:${suffix}:https`, tokenId: '0x01', column: 3, row: 4, navigationOrder: 0 }),
    placement({ id: `art:${suffix}:ipfs`, tokenId: '0x02', column: 14, row: 4, navigationOrder: 1 }),
  ];
  return buildProfileDocumentV8({ ...baseInput(address, suffix, assets), latticeDraft });
}

function createLegacyDocument(address, suffix, artworkUrl) {
  const assets = [assetRecord({ name: `${suffix} Legacy Artwork`, tokenId: '0x01', url: artworkUrl })];
  const workspace = {
    version: 8, profileAddress: address, favorites: [],
    folders: [{ id: 'legacy', name: `${suffix} Legacy Archive`, public: true, assetIds: [assetId('0x01')] }],
    canvas: { launchers: [], objects: [{
      id: `legacy:${suffix}:artwork`, kind: 'framed-artwork', stableAssetId: assetId('0x01'), visitorVisible: true,
      presentationOrder: 0, placement: { column: 8, row: 3 }, span: { columns: 4, rows: 4 },
      presentation: { frame: 'thin', mat: 'dark', background: 'dark', fit: 'contain' },
    }] },
  };
  return buildProfileDocumentV3({ ...baseInput(address, suffix, assets), workspace });
}

function currentAddress() {
  const candidate = new URLSearchParams(location.search).get('view')?.toLowerCase();
  return [PROFILE_A, PROFILE_B].includes(candidate) ? candidate : PROFILE_A;
}
const currentRuntime = () => new URLSearchParams(location.search).get('runtime') === 'legacy' ? 'legacy' : 'lattice';
const suffixFor = (address) => address === PROFILE_B ? 'Beta' : 'Alpha';

function Fixture() {
  const [address, setAddress] = useState(currentAddress);
  const [runtime, setRuntime] = useState(currentRuntime);
  const [moves, setMoves] = useState([]);
  const [artworkUrl, setArtworkUrl] = useState('https://published-images.invalid/art-Alpha.png');
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const directoryRepository = useMemo(() => ({ list: async () => [PROFILE_A, PROFILE_B].map((entry) => ({
    address: entry, name: `${suffixFor(entry)} Visitor Fixture`,
    avatarUrl: `https://published-images.invalid/avatar-${suffixFor(entry)}.png`, status: 'PUBLISHED',
  })) }), []);
  const suffix = suffixFor(address);
  const effectiveArtworkUrl = artworkUrl.replace(/Alpha|Beta/u, suffix);
  const document = useMemo(() => runtime === 'legacy'
    ? createLegacyDocument(address, suffix, effectiveArtworkUrl)
    : createCanonicalDocument(address, suffix, effectiveArtworkUrl), [address, effectiveArtworkUrl, runtime, suffix]);

  useEffect(() => {
    const updateRoute = () => { setAddress(currentAddress()); setRuntime(currentRuntime()); };
    addEventListener('popstate', updateRoute);
    return () => removeEventListener('popstate', updateRoute);
  }, []);
  const visit = (nextAddress) => {
    const next = new URL(location.href);
    next.searchParams.set('view', nextAddress);
    history.pushState({}, '', `${next.pathname}${next.search}`);
    setAddress(currentAddress());
    setDirectoryOpen(false);
  };
  useEffect(() => {
    window.__fixture = { address, runtime, ready: true, moves, resetMoves: () => setMoves([]), setArtworkUrl, visit };
  }, [address, moves, runtime]);

  return <div className="application-root" data-browser-fixture data-profile-address={address} data-runtime={runtime} data-application-mode="public">
    <div className="application-world" data-visible />
    <div className="application-interface" data-visible>
      <output data-testid="keeper-moves" data-count={moves.length}>{JSON.stringify(moves)}</output>
      <PublishedProfileDocumentPreview document={document}
        onMoveKeeper={(x, y, options) => setMoves((current) => [...current, { x, y, options }])}
        onOpenDirectory={() => setDirectoryOpen(true)} onReturn={address === PROFILE_A ? undefined : () => visit(PROFILE_A)} />
      {directoryOpen && <ProfileDiscoveryBoundary repository={directoryRepository} onClose={() => setDirectoryOpen(false)}
        onSelect={(profile) => visit(profile.address)} />}
    </div>
  </div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<Fixture />);
