import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import PublishedHomeWorld from '../src/profileDocument/components/PublishedHomeWorld.jsx';
import ProfileDiscoveryBoundary from '../src/profileDiscovery/ProfileDiscoveryBoundary.jsx';
import '../src/index.css';
import '../src/public/moduleGrid.css';
import '../src/library/collection.css';
import '../src/profileDocument/profileDocument.css';
import '../src/public/canvasObjects.css';

export const PROFILE_A = '0x1111111111111111111111111111111111111111';
export const PROFILE_B = '0x2222222222222222222222222222222222222222';
const CID = 'QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQw';

function createDocument(address, suffix) {
  const spaces = Array.from({ length: 7 }, (_, index) => ({
    id: `space:${suffix}:${index}`,
    order: index,
    label: `${suffix} Archive ${index + 1}`,
    kind: index === 1 ? 'favorites' : 'folder',
    placement: { column: -8 + (index % 4) * 5, row: -5 + Math.floor(index / 4) * 4 },
    appearance: { mode: 'icon_label', iconKey: index === 1 ? 'favorites' : 'folder', showLabel: true, columnSpan: 4, rowSpan: 2 },
    startOpen: index < 2,
    windowGeometry: { column: -7 + index * 2, row: -2 + index, columnSpan: 11, rowSpan: 8 },
    assets: index === 0 ? [{ stableAssetId: `42:${address}:0x10`, network: 'lukso-mainnet', chainId: 42, tokenStandard: 'LSP8', contractAddress: address, tokenId: '0x10', cachedName: `${suffix} Space Artwork`, cachedPreviewUrl: `ipfs://${CID}/space-${suffix}.png` }] : []
  }));
  return {
    version: 4,
    profile: { address, cachedIdentity: { name: `${suffix} Visitor Fixture`, avatarUrl: `https://published-images.invalid/avatar-${suffix}.png` } },
    presentation: { keeperId: 'skull_reaper', stageId: 'void', environment: null },
    spaces,
    canvasObjects: Array.from({ length: 3 }, (_, index) => ({
      id: `art:${suffix}:${index}`,
      order: index,
      placement: { column: 8 + index * 5, row: 3 },
      span: { columns: 4, rows: 4 },
      presentation: { frame: 'thin', mat: 'dark', background: 'dark', fit: 'contain' },
      asset: { stableAssetId: `42:${address}:0x0${index + 1}`, cachedName: `${suffix} Artwork ${index + 1}`, cachedPreviewUrl: index === 0 ? `https://published-images.invalid/art-${suffix}.png` : undefined }
    }))
  };
}

const DOCUMENTS = Object.freeze({
  [PROFILE_A]: createDocument(PROFILE_A, 'Alpha'),
  [PROFILE_B]: createDocument(PROFILE_B, 'Beta')
});

function currentAddress() {
  const candidate = new URLSearchParams(location.search).get('view')?.toLowerCase();
  return DOCUMENTS[candidate] ? candidate : PROFILE_A;
}

function Fixture() {
  const [address, setAddress] = useState(currentAddress);
  const [moves, setMoves] = useState([]);
  const [artworkUrl, setArtworkUrl] = useState(null);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const directoryRepository = useMemo(() => ({ list: async () => Object.values(DOCUMENTS).map((entry) => ({
    address: entry.profile.address,
    name: entry.profile.cachedIdentity.name,
    avatarUrl: entry.profile.cachedIdentity.avatarUrl,
    status: 'PUBLISHED'
  })) }), []);
  const document = useMemo(() => {
    const next = structuredClone(DOCUMENTS[address]);
    if (artworkUrl !== null) next.canvasObjects[0].asset.cachedPreviewUrl = artworkUrl;
    return next;
  }, [address, artworkUrl]);
  useEffect(() => {
    const updateRoute = () => setAddress(currentAddress());
    addEventListener('popstate', updateRoute);
    return () => removeEventListener('popstate', updateRoute);
  }, []);
  const visit = (nextAddress) => {
    history.pushState({}, '', `/browser-tests/fixture.html?view=${nextAddress}`);
    setAddress(currentAddress());
    setDirectoryOpen(false);
  };
  useEffect(() => {
    window.__fixture = {
      address,
      moves,
      resetMoves: () => setMoves([]),
      setArtworkUrl,
      visit
    };
  }, [address, moves]);
  return <div className="application-root" data-browser-fixture data-profile-address={address} data-application-mode="public">
    <div className="application-world" data-visible />
    <div className="application-interface" data-visible>
      <output data-testid="keeper-moves" data-count={moves.length}>{JSON.stringify(moves)}</output>
      <PublishedHomeWorld document={document} onMoveKeeper={(x, y) => setMoves((current) => [...current, { x, y }])}
        onOpenDirectory={() => setDirectoryOpen(true)} onReturn={address === PROFILE_A ? undefined : () => visit(PROFILE_A)} />
      {directoryOpen && <ProfileDiscoveryBoundary repository={directoryRepository} onClose={() => setDirectoryOpen(false)}
        onSelect={(profile) => visit(profile.address)} />}
    </div>
  </div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<Fixture />);
