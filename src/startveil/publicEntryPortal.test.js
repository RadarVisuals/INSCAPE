import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../App.jsx');
const portal = read('./PublicEntryPortal.jsx');
const startveil = read('./PortalStartveil.jsx');
const styles = read('./publicEntryPortal.css');
const walletSession = read('../wallet/standaloneWalletSession.js');

test('bare public entry resolves into a Portal without restoring the generic Enter gate', () => {
  assert.match(app, /portal=\{publicEntryPortal\}/);
  assert.match(startveil, /portal && ready \? <PublicEntryPortal/);
  assert.match(portal, />Discover</);
  assert.match(portal, />Connect</);
  assert.doesNotMatch(portal, />ENTER</);
  assert.match(startveil, /onExplore/);
  assert.match(startveil, /import '\.\/publicEntryPortal\.css'/);
  assert.doesNotMatch(startveil, /inscapeStartveil\.css/);
});

test('Discover unfolds inside the Portal and never enters the workspace Library shell', () => {
  assert.match(portal, /initialMode === 'explore' \? 'explore' : 'landing'/);
  assert.match(portal, /public-entry-portal__world-grid/);
  assert.match(portal, /Search published worlds/);
  assert.match(portal, /mode === 'landing'/);
  assert.doesNotMatch(portal, /PublicDiscoverExperience|OwnerSystemWorkflowDiscoverWorkspace/);
});

test('the same Discover surface can be opened from owner and visitor workspaces', () => {
  const panelLayer = read('../public/ownerSystemWorkflow/OwnerSystemWorkflowPanelLayer.jsx');
  const publishedBoundary = read('../profileDocument/components/PublishedProfileBoundary.jsx');
  assert.match(panelLayer, /<PublicEntryPortal[\s\S]*embedded initialMode="explore"/);
  assert.match(publishedBoundary, /onOpenDirectory=\{onOpenDiscover\}/);
  assert.match(portal, /onHome/);
});

test('Portal reuses the dock wordmark, canonical menu tokens, and production Grid renderer', () => {
  assert.match(styles, /url\('\/assets\/brand\/inscape-wordmark\.svg'\)/);
  assert.match(styles, /var\(--lattice-menu-panel/);
  assert.match(styles, /var\(--lattice-window-type-label\)/);
  assert.match(portal, /GridProductionRenderer/);
  assert.match(portal, /document\?\.metadata\?\.worldCover\?\.grid/);
  assert.match(portal, /data-surface=\{document\.appearance\.surfaceId\}/);
  assert.match(styles, /world-fit\[data-surface='mist'\]/);
});

test('profile avatar remains a small publisher signature rather than the world cover', () => {
  assert.match(portal, /public-entry-portal__publisher-avatar/);
  assert.match(styles, /public-entry-portal__publisher-avatar \{ width: 32px; height: 32px;/);
  assert.match(portal, /public-entry-portal__world-preview/);
  assert.doesNotMatch(portal, /world-preview[^\n]*avatarUrl/);
});

test('Connect Profile keeps the official UP Modal but presents it in the INSCAPE mist system', () => {
  assert.match(walletSession, /theme: 'light'/);
  assert.match(styles, /--up-modal-font-family:\s*"Inscape Sora"/);
  assert.match(styles, /--up-modal-bg:\s*var\(--lattice-menu-panel/);
  assert.match(styles, /--up-modal-border-radius:\s*0px/);
});
