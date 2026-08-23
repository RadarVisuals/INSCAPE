import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import ProfileDocumentV9Preview from '../src/profileDocument/components/ProfileDocumentV9Preview.jsx';
import ProfileDiscoveryBoundary from '../src/profileDiscovery/ProfileDiscoveryBoundary.jsx';
import { buildProfileDocumentV9 } from '../src/profileDocument/domain/profileDocumentV9Builder.js';
import { createEmptySystemWorkflowDraft } from '../src/systemWorkflow/domain/systemWorkflowDraft.js';
import '../src/index.css';

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
const placement = ({ id, tokenId, column, row, navigationOrder, crop = null, transform = null }) => ({
  id, stableAssetId: assetId(tokenId), column, row, columnSpan: 8, rowSpan: 7, layer: navigationOrder,
  navigationOrder, crop, frameId: navigationOrder === 0 ? 'DOSSIER' : 'CAPTION',
  mat: { enabled: false, color: '#090a0a', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#d8d4ca' }, transparencyMode: 'AUTO',
  visibility: 'PUBLIC', locked: true,
  transform: transform || { quarterTurns: 0, mirrorX: false, mirrorY: false },
});

function createCanonicalDocument(address, suffix, artworkUrl) {
  const assets = [
    assetRecord({ name: `${suffix} Artwork 1`, tokenId: '0x01', url: artworkUrl }),
    assetRecord({ name: `${suffix} IPFS Artwork`, tokenId: '0x02', url: `ipfs://${CID}/space-${suffix}.png` }),
  ];
  const systemWorkflowDraft = createEmptySystemWorkflowDraft(address, { generateId: () => `${suffix.toLowerCase()}-home` });
  systemWorkflowDraft.grids[0].title = `${suffix} Home`;
  systemWorkflowDraft.grids[0].subtitle = 'Visitor entry';
  systemWorkflowDraft.grids[0].placements = [
    placement({ id: `art:${suffix}:https`, tokenId: '0x01', column: 3, row: 4, navigationOrder: 0 }),
    placement({ id: `art:${suffix}:ipfs`, tokenId: '0x02', column: 14, row: 4, navigationOrder: 1,
      crop: { x: 0.2, y: 0.8, zoom: 1.75 }, transform: { quarterTurns: 1, mirrorX: true, mirrorY: false } }),
  ];
  systemWorkflowDraft.grids.push({
    ...structuredClone(systemWorkflowDraft.grids[0]), id: `grid:${suffix.toLowerCase()}-archive`,
    title: `${suffix} Archive`, subtitle: 'Ordered second Grid', placements: [],
  });
  return buildProfileDocumentV9({
    assetRecords: assets, createdAt: 1, exportedAt: 2, profileAddress: address,
    profileIdentity: { name: `${suffix} Visitor Fixture`, avatarUrl: `https://published-images.invalid/avatar-${suffix}.png` },
    revision: 1, systemWorkflowDraft,
  });
}

function currentAddress() {
  const candidate = new URLSearchParams(location.search).get('view')?.toLowerCase();
  return [PROFILE_A, PROFILE_B].includes(candidate) ? candidate : PROFILE_A;
}
const suffixFor = (address) => address === PROFILE_B ? 'Beta' : 'Alpha';

function Fixture() {
  const [address, setAddress] = useState(currentAddress);
  const runtime = 'grid';
  const [artworkUrl, setArtworkUrl] = useState('https://published-images.invalid/art-Alpha.png');
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const directoryRepository = useMemo(() => ({ list: async () => [PROFILE_A, PROFILE_B].map((entry) => ({
    address: entry, name: `${suffixFor(entry)} Visitor Fixture`,
    avatarUrl: `https://published-images.invalid/avatar-${suffixFor(entry)}.png`, status: 'PUBLISHED',
  })) }), []);
  const suffix = suffixFor(address);
  const effectiveArtworkUrl = artworkUrl.replace(/Alpha|Beta/u, suffix);
  const document = useMemo(() => createCanonicalDocument(address, suffix, effectiveArtworkUrl),
    [address, effectiveArtworkUrl, suffix]);

  useEffect(() => {
    const updateRoute = () => { setAddress(currentAddress()); };
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
    window.__fixture = { address, runtime, ready: true, setArtworkUrl, visit };
  }, [address, runtime]);

  return <div className="application-root" data-browser-fixture data-profile-address={address} data-runtime={runtime} data-application-mode="public">
    <div className="application-world" data-visible />
    <div className="application-interface" data-visible>
      <ProfileDocumentV9Preview document={document}
        onOpenDirectory={() => setDirectoryOpen(true)} onReturn={address === PROFILE_A ? undefined : () => visit(PROFILE_A)} />
      {directoryOpen && <ProfileDiscoveryBoundary repository={directoryRepository} onClose={() => setDirectoryOpen(false)}
        onSelect={(profile) => visit(profile.address)} />}
    </div>
  </div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<Fixture />);
