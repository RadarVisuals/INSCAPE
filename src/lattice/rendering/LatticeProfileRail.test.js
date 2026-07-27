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
  assert.match(source, /aria-current=\{active \? 'page'/);
  assert.match(source, /aria-expanded=\{!collapsed\}/);
  assert.match(source, /onCollapsedChange\?\.\(!collapsed\)/);
  assert.match(source, /event\.key !== 'Escape'/);
  assert.match(source, /onEscape\?\.\(\)/);
  assert.match(source, /inert=\{blocked \? '' : undefined\}/);
  assert.match(source, /visuallyCollapsed = collapsed \|\| compact/);
  assert.match(source, /!compact && <button/);
});

test('rail is fixed, carbon, compactable and does not shift the lattice', () => {
  assert.match(styles, /\.lattice-profile-rail\s*\{[^}]*--rail-width: 244px;[^}]*position: fixed;[^}]*top: 24px;[^}]*left: 24px;/s);
  assert.match(styles, /\.lattice-profile-rail\[data-collapsed\]\s*\{ --rail-width: 48px; \}/);
  assert.match(styles, /background: #101111/);
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.doesNotMatch(styles, /margin-left|padding-left: 244px|translateX\(244px\)/);
});
