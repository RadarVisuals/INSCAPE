import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import PublishedHomeWorld from '../src/profileDocument/components/PublishedHomeWorld.jsx';
import '../src/index.css';
import '../src/public/moduleGrid.css';
import '../src/library/collection.css';
import '../src/profileDocument/profileDocument.css';
import '../src/public/canvasObjects.css';

export const PROFILE_A = '0x1111111111111111111111111111111111111111';
export const PROFILE_B = '0x2222222222222222222222222222222222222222';

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
    assets: []
  }));
  return {
    version: 4,
    profile: { address, cachedIdentity: { name: `${suffix} Visitor Fixture`, avatarUrl: null } },
    presentation: { keeperId: 'skull_reaper', stageId: 'void', environment: null },
    spaces,
    canvasObjects: Array.from({ length: 3 }, (_, index) => ({
      id: `art:${suffix}:${index}`,
      order: index,
      placement: { column: 8 + index * 5, row: 3 },
      span: { columns: 4, rows: 4 },
      presentation: { frame: 'thin', mat: 'dark', background: 'dark', fit: 'contain' },
      asset: { stableAssetId: `42:${address}:0x0${index + 1}`, cachedName: `${suffix} Artwork ${index + 1}` }
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
  const document = useMemo(() => DOCUMENTS[address], [address]);
  useEffect(() => {
    const updateRoute = () => setAddress(currentAddress());
    addEventListener('popstate', updateRoute);
    return () => removeEventListener('popstate', updateRoute);
  }, []);
  useEffect(() => {
    window.__fixture = {
      address,
      moves,
      resetMoves: () => setMoves([]),
      visit(nextAddress) {
        history.pushState({}, '', `/browser-tests/fixture.html?view=${nextAddress}`);
        dispatchEvent(new PopStateEvent('popstate'));
      }
    };
  }, [address, moves]);
  return <div className="application-root" data-browser-fixture data-profile-address={address} data-application-mode="public">
    <div className="application-world" data-visible />
    <div className="application-interface" data-visible>
      <output data-testid="keeper-moves" data-count={moves.length}>{JSON.stringify(moves)}</output>
      <PublishedHomeWorld document={document} onMoveKeeper={(x, y) => setMoves((current) => [...current, { x, y }])} />
    </div>
  </div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<Fixture />);
