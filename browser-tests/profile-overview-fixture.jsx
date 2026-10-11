import React from 'react';
import { createRoot } from 'react-dom/client';
import PublishedProfileBoundary from '../src/profileDocument/components/PublishedProfileBoundary.jsx';
import useApplicationNavigation from '../src/profileDiscovery/useApplicationNavigation.js';
import { buildProfileDocumentV9 } from '../src/profileDocument/domain/profileDocumentV9Builder.js';
import { createEmptySystemWorkflowDraft } from '../src/systemWorkflow/domain/systemWorkflowDraft.js';
import { createDefaultWorkbenchPresentation } from '../src/profileDocument/domain/workbenchPresentation.js';
import { createProfileDocumentV9AssetResolver } from '../src/profileDocument/domain/profileDocumentV9Asset.js';
import { createArticle } from '../src/text/domain/article.js';
import '../src/index.css';

const address = `0x${'1'.repeat(40)}`, other = `0x${'2'.repeat(40)}`, contract = `0x${'3'.repeat(40)}`;
const assetId = `42:${contract}:0x01`;
const artwork = 'https://overview.invalid/landscape.jpg';
const asset = { id: assetId, chainId: 42, contractAddress: contract, tokenId: '0x01', standard: 'LSP8', name: 'Landforms',
  description: 'A landscape study.', imageUrl: artwork, originalImageUrl: artwork, imageWidth: 1600, imageHeight: 900,
  creators: [], attributes: [] };
const draft = createEmptySystemWorkflowDraft(address, { generateId: () => 'first' });
draft.appearance.guideMode = 'NONE';
draft.identityPresentation.alias = 'Mara Vale';
draft.identityPresentation.bio = { mode: 'inscape', customText: 'An ongoing collection of landscapes, stories and small worlds. Based somewhere between the real and the imagined.' };
draft.grids[0].title = 'Landforms'; draft.grids[0].subtitle = 'Studies in light and distance';
draft.grids[0].placements = [{ id: 'landscape', stableAssetId: assetId, column: 0, row: 0,
  columnSpan: draft.geometry.columns, rowSpan: draft.geometry.rows, layer: 0, navigationOrder: 0,
  crop: null, frameId: 'NONE', mat: { enabled: false, color: '#000000', inset: { top: 0, right: 0, bottom: 0, left: 0 } },
  backing: { enabled: false, color: '#ffffff' }, transparencyMode: 'AUTO', visibility: 'PUBLIC', locked: false,
  transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } }];
draft.grids.push({ ...structuredClone(draft.grids[0]), id: 'grid:second', title: 'After the rain',
  placements: [{ ...structuredClone(draft.grids[0].placements[0]), id: 'rain', transform: { quarterTurns: 0, mirrorX: true, mirrorY: false } }] });
draft.workbench = createDefaultWorkbenchPresentation(); draft.workbench.display.open = false;
draft.imageModules = [{ id: 'image:study', visibility: 'PUBLIC', name: 'A closer look', width: 640, height: 360,
  sides: [{ id: 'side:first', asset: createProfileDocumentV9AssetResolver([asset])(assetId), crop: null,
    transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } }] }];
draft.workbench.imageModules = [{ id: 'image:study', open: false, position: { left: 2200, top: 1800 } }];
const article = createArticle('Notes from the field');
article.content.content[0].content = [{ type: 'text', text: 'Some places are better remembered as a colour, or a change in the light. These fragments are the beginnings of a larger world.' }];
draft.texts = [{ id: 'text:notes', visibility: 'PUBLIC', article }];
draft.workbench.texts = [{ id: 'text:notes', open: false, window: { left: 1800, top: 1400, width: 600, height: 460 } }];
const published = buildProfileDocumentV9({ profileAddress: address, profileIdentity: { name: 'Mara Vale' }, assetRecords: [asset], systemWorkflowDraft: draft });
const second = structuredClone(published); second.profile.address = other; second.profile.cachedIdentity.address = other;
second.identityPresentation.alias = 'Another world'; second.grids = []; delete second.texts; delete second.imageModules; delete second.workbench;
window.__overviewPublication = published;

function Fixture() {
  const navigation = useApplicationNavigation({ status: 'complete', profileAddress: null, ownershipVerified: false });
  const content = navigation.content, selected = content?.address === other ? second : published;
  return <div className="application-root"><div className="application-interface" data-visible>
    {navigation.destination.kind === 'discover' ? <main style={{ pointerEvents: 'auto' }}><button onClick={navigation.closeDiscover}>Close Discover</button><button onClick={() => navigation.visitProfile(other)}>Another world</button></main>
      : <PublishedProfileBoundary address={selected.profile.address} resolution={{ status: 'RESOLVED', document: selected }}
        entry={{ surface: content?.canvas ? 'canvas' : 'overview', target: content?.target, reception: content?.reception }}
        onOpenWork={target => navigation.openWork(selected.profile.address, target)} onCloseWork={() => navigation.closeWork(selected.profile.address)}
        onOpenCanvas={target => navigation.openCanvas(selected.profile.address, target)} onOpenOverview={() => navigation.openOverview(selected.profile.address)}
        onOpenDiscover={navigation.openDiscover} />}
  </div></div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
