import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import PublishedHomeWorld from '../src/profileDocument/components/PublishedHomeWorld.jsx';
import ProfileDocumentPreview from '../src/profileDocument/components/ProfileDocumentPreview.jsx';
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
    version: 5,
    documentId: `profile:${address}`,
    revision: 1,
    profile: { address, cachedIdentity: {
      address, name: `${suffix} Visitor Fixture`, avatarUrl: `https://published-images.invalid/avatar-${suffix}.png`,
      description: `${suffix} public identity statement.`, tags: ['ART', 'MOTION'],
      links: [{ label: 'PUBLIC ARCHIVE', url: 'https://published-links.invalid/archive' }]
    } },
    presentation: { keeperId: 'skull_reaper', stageId: 'void', environment: null, racks: [{ id: 'identity', order: 0, visible: true, modules: [
      { id: 'profile', order: 0, visible: true, startOpen: false },
      { id: 'bio', order: 1, visible: true, startOpen: false },
      { id: 'links-tags', order: 2, visible: true, startOpen: false }
    ] }] },
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
  const [keeperCues, setKeeperCues] = useState([]);
  const [previewActive, setPreviewActive] = useState(true);
  const [artworkUrl, setArtworkUrl] = useState(null);
  const keeperPositionTarget = useRef(null);
  const keeperPreview = new URLSearchParams(location.search).get('preview') === 'keeper';
  const reactionBridge = useMemo(() => ({
    getAvailability: () => ({ ready: true, residentHandoff: false, actorMoving: false }),
    trigger: (cue) => { setKeeperCues((current) => [...current, cue]); return true; }
  }), []);
  const positionTracker = useMemo(() => ({
    trackActorPosition(target) {
      keeperPositionTarget.current = target;
      target?.style.setProperty('--actor-screen-x', '200px');
      target?.style.setProperty('--actor-screen-y', '300px');
    }
  }), []);
  const document = useMemo(() => {
    const next = structuredClone(DOCUMENTS[address]);
    if (artworkUrl !== null) next.canvasObjects[0].asset.cachedPreviewUrl = artworkUrl;
    if (new URLSearchParams(location.search).get('rack') === 'identity') next.presentation.racks[0].modules[0].startOpen = false;
    return next;
  }, [address, artworkUrl]);
  useEffect(() => {
    const updateRoute = () => setAddress(currentAddress());
    addEventListener('popstate', updateRoute);
    return () => removeEventListener('popstate', updateRoute);
  }, []);
  useEffect(() => {
    window.__fixture = {
      address,
      moves,
      keeperCues,
      previewActive,
      moveTrackedKeeper(x, y) {
        keeperPositionTarget.current?.style.setProperty('--actor-screen-x', `${x}px`);
        keeperPositionTarget.current?.style.setProperty('--actor-screen-y', `${y}px`);
      },
      resetMoves: () => setMoves([]),
      setArtworkUrl,
      visit(nextAddress) {
        history.pushState({}, '', `/browser-tests/fixture.html?view=${nextAddress}`);
        dispatchEvent(new PopStateEvent('popstate'));
      }
    };
  }, [address, keeperCues, moves, previewActive]);
  return <div className="application-root" data-browser-fixture data-profile-address={address} data-application-mode="public">
    <div className="application-world" data-visible />
    <div className="application-interface" data-visible>
      <output data-testid="keeper-moves" data-count={moves.length}>{JSON.stringify(moves)}</output>
      {keeperPreview
        ? previewActive
          ? <ProfileDocumentPreview document={document} onExit={() => setPreviewActive(false)} onMoveKeeper={(x, y) => setMoves((current) => [...current, { x, y }])} reactionBridge={reactionBridge} positionTracker={positionTracker} />
          : <output data-preview-exited>Keeper Preview exited</output>
        : <PublishedHomeWorld document={document} onMoveKeeper={(x, y) => setMoves((current) => [...current, { x, y }])} />}
    </div>
  </div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<Fixture />);
