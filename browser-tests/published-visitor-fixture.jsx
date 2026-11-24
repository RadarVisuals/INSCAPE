import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import ProfileDocumentV9Preview from '../src/profileDocument/components/ProfileDocumentV9Preview.jsx';
import { buildProfileDocumentV9Asset } from '../src/profileDocument/domain/profileDocumentV9Asset.js';
import { buildProfileDocumentV9 } from '../src/profileDocument/domain/profileDocumentV9Builder.js';
import { createEmptySystemWorkflowDraft } from '../src/systemWorkflow/domain/systemWorkflowDraft.js';
import '../src/index.css';
import { createDefaultWorkbenchPresentation } from '../src/profileDocument/domain/workbenchPresentation.js';

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
function createCanonicalDocument(address, suffix, artworkUrl) {
  const assets = [
    assetRecord({ name: `${suffix} Artwork 1`, tokenId: '0x01', url: artworkUrl }),
    assetRecord({ name: `${suffix} IPFS Artwork`, tokenId: '0x02', url: `ipfs://${CID}/space-${suffix}.png` }),
  ];
  const systemWorkflowDraft = createEmptySystemWorkflowDraft(address, { generateId: () => `${suffix.toLowerCase()}-home` });

  const covered = new URLSearchParams(location.search).has('covered');
  systemWorkflowDraft.imageModules = assets.map((asset, index) => ({
    id: index ? 'image:ipfs' : 'image:https',
    name: asset.name,
    width: covered ? 1200 : 280,
    height: covered ? 680 : 180,
    visibility: 'PUBLIC',
    artwork: {
      id: index ? 'artwork:ipfs' : 'artwork:https',
      asset: buildProfileDocumentV9Asset(asset, asset.id),
      crop: index ? { x: 0.2, y: 0.8, zoom: 1.75 } : { x: 0.5, y: 0.5, zoom: 1 },
      transform: { quarterTurns: index, mirrorX: Boolean(index), mirrorY: false },
    },
  }));
  systemWorkflowDraft.workbench = createDefaultWorkbenchPresentation();
  systemWorkflowDraft.workbench.identity.open = false;
  systemWorkflowDraft.workbench.imageModules = systemWorkflowDraft.imageModules.map(({ id }, index) => ({
    id, open: true, position: { left: covered ? 0 : 45 + index * 330, top: covered ? 0 : 90 },
  }));
  if (new URLSearchParams(location.search).has('workbench')) {
    systemWorkflowDraft.workbench.identity.open = true;
    systemWorkflowDraft.workbench.identity.window = { left: 80, top: 64, width: 680 };
    systemWorkflowDraft.identityPresentation.alias = 'HUMAN UNDERNEATH';
    systemWorkflowDraft.identityPresentation.card = { version: 1,
      background: { type: 'clouds', color: '#7139a5', speed: 0.5 },
      fields: [{ id: 'field:place', label: 'Location', type: 'text', value: 'The Underneath' }] };
  }
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
  const [artworkUrl, setArtworkUrl] = useState('https://published-images.invalid/art-Alpha.png');
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
  };
  useEffect(() => {
    window.__fixture = { address, ready: true, setArtworkUrl, visit };
  }, [address]);

  return <div className="application-root" data-browser-fixture data-profile-address={address} data-application-mode="public">
    <div className="application-world" data-visible />
    <div className="application-interface" data-visible>
      <ProfileDocumentV9Preview document={document}
        onReturn={address === PROFILE_A ? undefined : () => visit(PROFILE_A)} />
    </div>
  </div>;
}

ReactDOM.createRoot(document.getElementById('root')).render(<Fixture />);
