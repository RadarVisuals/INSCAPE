import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./LatticeProfileRail.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./latticeProfileRail.css', import.meta.url), 'utf8');

test('profile rail is an injected public-navigation shell with an explicit unresolved identity state', () => {
  assert.match(source, /officialIdentity = null/);
  assert.match(source, /UNRESOLVED PROFILE/);
  assert.match(source, /UNIVERSAL PROFILE/);
  assert.match(source, /entries\.map/);
  assert.match(source, /ENTRY_ICONS/);
  assert.doesNotMatch(source, /Browser|Index|Arrange|Settings|Theme|Publish/);
  assert.doesNotMatch(source, /0x[0-9a-f]|PFP\.webp|VXCTXR|localStorage|sessionStorage|wallet|publish/iu);
});

test('rail collapse, selection, focus and Escape remain controlled by the caller', () => {
  assert.match(source, /activeEntryId/);
  assert.match(source, /const visuallyCollapsed = identityOnly \? false : collapsed \|\| compact/);
  assert.match(source, /aria-current=\{active \? 'page'/);
  assert.match(source, /aria-expanded=\{!collapsed\}/);
  assert.match(source, /onCollapsedChange\?\.\(!collapsed\)/);
  assert.match(source, /aria-expanded=\{expanded\}/);
  assert.match(source, /ref=\{identityControlRef\}/);
  assert.match(source, /event\.key !== 'Escape'/);
  assert.match(source, /onEscape\?\.\(\)/);
  assert.match(source, /inert=\{blocked \? '' : undefined\}/);
  assert.match(source, /!compact && <button/);
  assert.match(source, /disabled=\{entry\.disabled === true\}/);
  assert.match(source, /disabled=\{disabled\}/);
  assert.match(source, /temporarily unavailable/);
  assert.doesNotMatch(source, /Identity dossier is not available in Phase 4/);
});

test('rail is fixed, carbon, compactable and does not shift the lattice', () => {
  assert.match(styles, /\.lattice-profile-rail\s*\{[^}]*--rail-width: 244px;[^}]*position: fixed;[^}]*top: 24px;[^}]*left: 24px;/s);
  assert.match(styles, /\.lattice-profile-rail\[data-collapsed\]\s*\{ --rail-width: 48px; \}/);
  assert.match(styles, /background: var\(--lattice-menu-panel\)/);
  assert.match(styles, /transition:[^;]*width 180ms[^;]*opacity 180ms linear;/s);
  assert.match(styles, /\.lattice-profile-rail\[data-blocked\]\s*\{[^}]*opacity: 0;[^}]*pointer-events: none;/s);
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.doesNotMatch(styles, /margin-left|padding-left: 244px|translateX\(244px\)/);
  assert.match(styles, /button:disabled/);
});

test('rail uses the approved type hierarchy, loaded aliases and clear Lucide chevrons', () => {
  assert.match(source, /ChevronRight/);
  assert.doesNotMatch(source, /<i[^>]*>›<\/i>/);
  assert.match(styles, /font: 600 14px\/1 "Inscape Sora"/);
  assert.match(styles, /font-size: 10px; font-weight: 500; letter-spacing: 0\.105em/);
  assert.match(styles, /font-family: "Inscape IBM Plex Sans Condensed"/);
  assert.match(styles, /stroke-width: 2/);
  assert.match(styles, /color: var\(--lattice-menu-ink\)/);
  assert.doesNotMatch(styles, /"IBM Plex Mono"|"Courier New"/);
});
