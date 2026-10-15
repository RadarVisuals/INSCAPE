import { stageFixtureChecks } from './stageFixtureChecks.js';
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import PublishedProfileBoundary from '../src/profileDocument/components/PublishedProfileBoundary.jsx';
import useApplicationNavigation from '../src/profileDiscovery/useApplicationNavigation.js';
import { buildProfileDocumentV9 } from '../src/profileDocument/domain/profileDocumentV9Builder.js';
import { createEmptySystemWorkflowDraft } from '../src/systemWorkflow/domain/systemWorkflowDraft.js';
import { createDefaultWorkbenchPresentation } from '../src/profileDocument/domain/workbenchPresentation.js';
import { createProfileDocumentV9AssetResolver } from '../src/profileDocument/domain/profileDocumentV9Asset.js';
import { createArticle } from '../src/text/domain/article.js';
import { systemWorkflowDraftKey } from '../src/systemWorkflow/systemWorkflowDraftStore.js';
import '../src/index.css';

const address = `0x${'1'.repeat(40)}`, other = `0x${'2'.repeat(40)}`, contract = `0x${'3'.repeat(40)}`;
const assetId = `42:${contract}:0x01`;
const boundedReview = new URLSearchParams(location.search).has('bounded');
const stageArtwork = (width, height) => 'data:image/svg+xml;base64,' + btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '"><rect x="3" y="3" width="' + (width-6) + '" height="' + (height-6) + '" fill="#25384a" stroke="#f3a850" stroke-width="6"/><circle cx="' + width/2 + '" cy="' + height/2 + '" r="' + Math.min(width,height)*.28 + '" fill="none" stroke="white" stroke-width="4"/></svg>');
const artwork = boundedReview ? stageArtwork(1600,900) : 'https://overview.invalid/landscape.jpg';
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
const linkedReview = new URLSearchParams(location.search).has('linked');
if (linkedReview) {
  draft.workbench.display.open = true;
  draft.workbench.display.name = 'Story Display';
  draft.appearance.surfaceId = 'carbon';
  draft.grids.filter(grid => grid.id !== 'grid:world-cover').forEach((grid, index) => {
    grid.placements = [{ id: 'label-' + index, kind: 'text', text: { content: index ? 'SCENE TWO' : 'SCENE ONE', font: 'sora', size: 42, color: '#ffffff', alignment: 'center', bold: false, italic: false },
      column: 4, row: 6, columnSpan: 24, rowSpan: 6, layer: 0, navigationOrder: 0, visibility: 'PUBLIC', locked: false,
      transform: { quarterTurns: 0, mirrorX: false, mirrorY: false } }];
  });
  const sections = createArticle('Linked sections');
  sections.content = { type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'FIRST SECTION — follows Landforms' }] },
    { type: 'pageBreak' },
    { type: 'paragraph', content: [{ type: 'text', text: 'SECOND SECTION — follows After the rain' }] },
  ] };
  const passage = createArticle('Linked passage');
  passage.content.content[0].content = [{ type: 'text', text: 'FIRST PASSAGE — Landforms' }];
  const next = createArticle('Next passage');
  next.content.content[0].content = [{ type: 'text', text: 'SECOND PASSAGE — After the rain' }];
  draft.texts = [
    { id: 'text:sections', visibility: 'PUBLIC', article: sections, sceneLink: { mode: 'sections', displayId: 'display:primary' } },
    { id: 'text:passages', visibility: 'PUBLIC', article: passage, pagination: 'pages', sceneLink: { displayId: 'display:primary', gridId: draft.grids[0].id, passages: [{ gridId: 'grid:second', article: next }] } },
  ];
  draft.workbench.texts = draft.texts.map((record, index) => ({ id: record.id, open: true,
    window: { left: 2100 + index * 450, top: 1950, width: 420, height: 240 } }));
  draft.displays = [{ id: 'display:other', visibility: 'PUBLIC', artboard: draft.artboard, geometry: draft.geometry, appearance: draft.appearance,
    grids: draft.grids.map((grid, index) => grid.id === 'grid:world-cover' ? grid : ({ ...grid, id: index === 0 ? grid.id : 'grid:other-' + index, title: 'Independent ' + (index + 1) })) }];
  draft.workbench.displays = [{ ...structuredClone(draft.workbench.display), id: 'display:other', name: 'Independent Display' }];
}
if (boundedReview) {
  draft.imageModules[0].sides = [['landscape',480,240],['portrait',240,480],['square',320,320]].map(([name,width,height]) => ({
    id: 'side:' + name, asset: { ...draft.imageModules[0].sides[0].asset, name, description: 'Complete artwork with a visible border. '.repeat(40),
      media: { type: 'image', url: stageArtwork(width,height), width, height } },
    // Authored crop must not carry into the temporary full-source inspection.
    crop: { x: .2, y: .2, zoom: 2 }, transform: { quarterTurns: 0, mirrorX: false, mirrorY: false },
  }));
}
const receptionCardReview = new URLSearchParams(location.search).has('card');
const publicationAssets = [asset];
if (receptionCardReview) {
  const portrait = { ...asset, id: `42:${contract}:0x02`, tokenId: '0x02', name: 'Identity artwork',
    imageUrl: 'https://reception-card.invalid/portrait.webp', originalImageUrl: 'https://reception-card.invalid/portrait.webp', imageWidth: 800, imageHeight: 1200 };
  publicationAssets.push(portrait);
  draft.identityPresentation.avatar = { mode: 'inscape', stableAssetId: portrait.id, shape: 'square' };
  draft.identityPresentation.alias = 'Human underneath';
  draft.identityPresentation.bio = { mode: 'inscape', customText: 'I wake in the dust, the wind stirring only the fabric draped around my absence.' };
  draft.identityPresentation.tags = { includeOfficial: true, additional: ['Artist', 'Non-fiction', 'Self Expression'] };
  draft.identityPresentation.card = { version: 1, columns: 2, background: { type: 'clouds', color: null, speed: 1 }, fields: [
    { id: 'field:location', label: 'Location', type: 'text', value: 'Underneath' },
    { id: 'field:occupation', label: 'Occupation', type: 'text', value: 'Nomad' },
  ] };
  draft.appearance.menuSurfaceId = 'carbon';
  const resolver = createProfileDocumentV9AssetResolver(publicationAssets);
  draft.imageModules = Array.from({ length: 16 }, (_,index) => ({ id: 'image:card-' + index, name: 'Artwork ' + (index + 1), visibility: 'PUBLIC', width: 300, height: 450,
    sides: [{ id: 'side:front', asset: index < 4 ? { ...resolver(portrait.id), name: 'Artwork ' + (index + 1) }
      : { ...resolver(assetId), name: 'Artwork ' + (index + 1), media: { type: 'image', url: stageArtwork(480, 240), width: 480, height: 240 } }, crop: null,
      transform: { quarterTurns: 0, mirrorX: index % 2 === 1, mirrorY: false } }] }));
  draft.workbench.imageModules = draft.imageModules.map(record => ({ id: record.id, open: false, position: { left: 2000, top: 1800 } }));
}
const published = buildProfileDocumentV9({ profileAddress: address, profileIdentity: { name: receptionCardReview ? 'nomad' : 'Mara Vale' }, assetRecords: publicationAssets, systemWorkflowDraft: draft });
if (receptionCardReview && new URLSearchParams(location.search).has('curated')) published.reception = { version: 1, items: ['image:card-0'] };
const ownerReview = new URLSearchParams(location.search).has('owner');
if (ownerReview && !new URLSearchParams(location.search).has('missing-draft') && !localStorage.getItem(systemWorkflowDraftKey(address))) localStorage.setItem(systemWorkflowDraftKey(address), JSON.stringify(draft));
const second = structuredClone(published); second.profile.address = other; second.profile.cachedIdentity.address = other;
second.identityPresentation.alias = 'Another world'; second.grids = []; delete second.texts; delete second.imageModules; delete second.workbench;
window.__overviewPublication = published;

function Fixture() {
  const [review, setReview] = useState('Ready to check shared motion');
  const runStageChecks = async () => { setReview('Checking stage…'); try { setReview(await stageFixtureChecks(published)); } catch(error) { setReview('FAIL: ' + error.message); } };
  const runChecks = async () => {
    const checks = [], assert = (value, label) => { if (!value) throw Error(label); checks.push(label); };
    const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
    const primary = document.querySelector('[data-display-instance="display:primary"]');
    const stage = primary?.querySelector('[data-active-grid-id]');
    const first = () => stage?.dataset.activeGridId;
    const text = id => document.querySelector('[data-text-id="text:' + id + '"] .text-scene-track');
    const advance = () => document.querySelector('[aria-label="Next Grid"]').click();
    const publication = JSON.stringify(published);
    try {
      assert(document.querySelectorAll('.published-display').length === 2, 'Two intact Display modules');
      const onCanvas = Boolean(document.querySelector('[data-workbench]'));
      assert(onCanvas || !document.querySelector('.system-workflow__workbench'), onCanvas ? 'Canvas uses shared module' : 'Reception has no canvas host');
      const initial = first(); advance(); await frame(); await frame();
      assert(first() !== initial, 'Next Grid stays inside its module');
      assert(primary.querySelector('[data-rendered-grid-id="grid:second"] [data-text-placement-id]')?.textContent.includes('SCENE TWO'), 'Text placed inside Display stays in its scene');
      assert(text('sections').textContent.includes('SECOND SECTION'), 'Page-break section follows Grid');
      assert(text('passages').textContent.includes('SECOND PASSAGE'), 'Per-Grid passage follows Grid');
      assert(document.querySelector('[data-display-instance="display:other"] [data-active-grid-id]').dataset.activeGridId === initial, 'Other Display keeps its own scene');
      advance(); await frame(); await frame();
      stage.scrollIntoView({ block: 'center' }); await frame();
      const r = stage.getBoundingClientRect(), x = r.left + r.width * .7, y = r.top + r.height * .5;
      stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, button: 0, clientX: x, clientY: y }));
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: x - r.width * .35, clientY: y }));
      await frame(); await frame();
      const normalized = node => new DOMMatrix(getComputedStyle(node).transform).m41 / node.clientWidth;
      const motion = normalized(primary.querySelector('.visitor-grid-world__grid-track'));
      assert(Math.abs(motion) > .2, 'Display moves during held swipe');
      assert(Math.abs(normalized(text('sections')) - motion) < .01, 'Sections share swipe progress');
      assert(Math.abs(normalized(text('passages')) - motion) < .01, 'Passages share swipe progress');
      window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, clientX: x, clientY: y }));
      for (let n = 0; n < 100; n++) await frame();
      if (!onCanvas) {
      primary.querySelector('[aria-label="Play Grids"]').click();
      for (let n = 0; n < 20; n++) await frame();
      assert(primary.querySelector('[aria-label="Pause Grids"]'), 'Autoplay starts');
      const a = normalized(primary.querySelector('.visitor-grid-world__grid-track'));
      for (let n = 0; n < 12; n++) await frame();
      assert(normalized(primary.querySelector('.visitor-grid-world__grid-track')) !== a, 'Autoplay advances the rail');
      primary.querySelector('[aria-label="Pause Grids"]').click();
      await frame(); const stopped = normalized(primary.querySelector('.visitor-grid-world__grid-track'));
      for (let n = 0; n < 12; n++) await frame();
      assert(Math.abs(normalized(primary.querySelector('.visitor-grid-world__grid-track')) - stopped) < .001, 'Pause freezes the rail');
      }
      assert(JSON.stringify(published) === publication, 'Publication stays unchanged');
      setReview(checks.join(' · ') + ' — PASS');
    } catch (error) { setReview(checks.join(' · ') + ' — FAIL: ' + error.message); }
  };
  const navigation = useApplicationNavigation({ status: 'complete', profileAddress: null, ownershipVerified: false });
  const content = navigation.content, selected = content?.address === other ? second : published;
  return <div className="application-root">{(linkedReview || boundedReview) && <aside style={{ position: 'fixed', zIndex: 999, bottom: 0, left: 0, maxWidth: '100%', background: '#222', color: 'white', pointerEvents: 'auto', padding: 8, fontSize: 12 }}>
    <button onClick={runChecks}>Run module checks</button>{boundedReview && <button onClick={runStageChecks}>Run stage checks</button>}<output aria-label="Module check results">{review}</output>
  </aside>}<div className="application-interface" data-visible>
    {navigation.destination.kind === 'discover' ? <main style={{ pointerEvents: 'auto' }}><button onClick={navigation.closeDiscover}>Close Discover</button><button onClick={() => navigation.visitProfile(other)}>Another world</button></main>
      : <PublishedProfileBoundary address={selected.profile.address} resolution={{ status: 'RESOLVED', document: selected }}
        returnProfileAddress={ownerReview ? address : undefined} onReturnToWorkbench={ownerReview ? () => {} : undefined}
        entry={{ surface: content?.canvas ? 'canvas' : 'overview', target: content?.target, reception: content?.reception }}
        onOpenWork={target => navigation.openWork(selected.profile.address, target)} onCloseWork={() => navigation.closeWork(selected.profile.address)}
        onOpenCanvas={target => navigation.openCanvas(selected.profile.address, target)} onOpenOverview={() => navigation.openOverview(selected.profile.address)}
        onOpenDiscover={navigation.openDiscover} />}
  </div></div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
