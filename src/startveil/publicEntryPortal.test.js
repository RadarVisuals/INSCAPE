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
  assert.match(portal, />EXPLORE WORLDS</);
  assert.match(portal, />CONNECT</);
  assert.doesNotMatch(portal, />ENTER</);
  assert.doesNotMatch(startveil, /onExplore/);
  assert.match(startveil, /import '\.\/publicEntryPortal\.css'/);
  assert.doesNotMatch(startveil, /inscapeStartveil\.css/);
});

test('Explore Worlds unfolds inside the Portal and never enters the workspace Library shell', () => {
  assert.match(portal, /initialMode === 'explore' \? 'explore' : 'landing'/);
  assert.match(portal, /public-entry-portal__world-grid/);
  assert.match(portal, /Search published worlds/);
  assert.match(portal, /mode === 'landing'/);
  assert.doesNotMatch(portal, /PublicDiscoverExperience|OwnerSystemWorkflowDiscoverWorkspace/);
});

test('the same Explore Worlds surface can be opened from owner and visitor workspaces', () => {
  const panelLayer = read('../public/ownerSystemWorkflow/OwnerSystemWorkflowPanelLayer.jsx');
  const publishedBoundary = read('../profileDocument/components/PublishedProfileBoundary.jsx');
  assert.match(panelLayer, /<PublicEntryPortal embedded initialMode="explore"/);
  assert.match(publishedBoundary, /<PublicEntryPortal embedded initialMode="explore"/);
  assert.match(portal, /onClose \? onClose\(\) : setMode\('landing'\)/);
});

test('public directory navigation and search reuse the owner dock and Library interaction language', () => {
  assert.match(portal, /public-entry-portal__header-search/);
  assert.match(portal, /<Search aria-hidden="true" size=\{13\}/);
  assert.match(styles, /font: 450 11px\/1 "Inscape Sora", sans-serif/);
  assert.match(styles, /header nav button\[aria-current='page'\]::after[^}]*height: 4px/s);
  assert.match(styles, /header-search:focus-within[^}]*box-shadow: inset 0 -4px 0 var\(--lattice-menu-ink\)/s);
  assert.doesNotMatch(portal, /public-entry-portal__coordinates/);
  assert.doesNotMatch(portal, /INSCAPE<br \/>PUBLIC NETWORK|<i aria-hidden="true">\+<\/i>/);
  assert.doesNotMatch(portal, /ESC RETURN|RETURN TO PORTAL|public-entry-portal__axis/);
});

test('public directory hierarchy lives in the header while cards retain the hidden snap geometry', () => {
  assert.doesNotMatch(portal, /<header><h1>EXPLORE WORLDS|PUBLISHED WORLDS<\/span>/);
  assert.match(styles, /grid-template-columns: repeat\(auto-fill, calc\(var\(--portal-grid-size\) \* 6\)\)/);
  assert.match(styles, /world-grid[^}]*gap: var\(--portal-grid-size\)/s);
  assert.match(styles, /header-wordmark i \{ width: 156px/);
  assert.match(styles, /header nav \{[^}]*grid-column: 3/s);
  assert.match(styles, /public-entry-portal__footer \{[^}]*height: 28px/s);
  assert.doesNotMatch(styles, /background-image:\s*linear-gradient\(var\(--lattice-menu-line/);
});

test('standalone and embedded Explore share one opaque Mist canvas and responsive snap unit', () => {
  assert.match(styles, /\.public-entry-portal \{[\s\S]*--portal-grid-size: 4\.166667vw;/);
  assert.match(styles, /\.public-entry-portal \{[\s\S]*background: rgb\(215 211 202\);/);
  assert.match(styles, /\.public-entry-portal \{[\s\S]*pointer-events: auto;/);
  assert.doesNotMatch(styles, /\.public-entry-portal\[data-embedded\][^{]*\{[^}]*background:/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.public-entry-portal \{ --portal-grid-size: 8\.333333vw; \}/);
});

test('Portal reuses the dock wordmark, canonical menu tokens, and production Grid renderer', () => {
  assert.match(styles, /url\('\/assets\/brand\/inscape-wordmark\.svg'\)/);
  assert.match(styles, /var\(--lattice-menu-panel/);
  assert.match(styles, /var\(--lattice-window-type-label\)/);
  assert.match(portal, /GridProductionRenderer/);
  assert.match(portal, /document\?\.grids\?\.\[0\]/);
  assert.match(portal, /data-surface=\{document\.appearance\.surfaceId\}/);
  assert.match(styles, /world-fit\[data-surface='mist'\]/);
});

test('profile avatar remains a small publisher signature rather than the world cover', () => {
  assert.match(portal, /public-entry-portal__publisher-avatar/);
  assert.match(styles, /public-entry-portal__publisher-avatar \{ width: 38px; height: 38px;/);
  assert.match(portal, /public-entry-portal__world-preview/);
  assert.doesNotMatch(portal, /world-preview[^\n]*avatarUrl/);
});

test('Connect Profile keeps the official UP Modal but presents it in the INSCAPE mist system', () => {
  assert.match(walletSession, /theme: 'light'/);
  assert.match(styles, /--up-modal-font-family:\s*"Inscape Sora"/);
  assert.match(styles, /--up-modal-bg:\s*var\(--lattice-menu-panel/);
  assert.match(styles, /--up-modal-border-radius:\s*0px/);
});
