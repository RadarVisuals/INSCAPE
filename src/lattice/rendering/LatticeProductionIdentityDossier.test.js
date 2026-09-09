import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createDisclosureModuleTracks } from './disclosureModuleTracks.js';

const source = readFileSync(new URL('./LatticeProductionIdentityDossier.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./latticeProductionIdentityDossier.css', import.meta.url), 'utf8');
const disclosure = readFileSync(new URL('./DisclosureModule.jsx', import.meta.url), 'utf8');

test('uses a body portal with reversible inert ownership, reliable closing, and a manual focus trap', () => {
  assert.match(source, /createPortal\(<section/);
  assert.match(source, /document\.body\.children/);
  assert.match(source, /hadInert: node\.hasAttribute\('inert'\)/);
  assert.match(source, /else node\.removeAttribute\('inert'\)/);
  assert.match(source, /event\.key !== 'Escape'/);
  assert.match(source, /window\.addEventListener\('keydown', closeOnEscape, true\)/);
  assert.match(source, /setPhase\('opening'\)/);
  assert.match(source, /setPhase\('closing'\)/);
  assert.match(source, /data-identity-dossier-backdrop/);
  assert.match(source, /phase === 'open' && dismissOnBackdrop\) requestDismiss\(\)/);
  assert.match(source, /dismissAfterCloseRef\.current[\s\S]*onDismiss\?\.\(\);[\s\S]*if \(!persistent\)/);
  assert.match(source, /else if \(phase === 'open'\) requestClose\(\);[\s\S]*phase === 'compact'\) onDismiss\?\.\(\)/);
  assert.match(source, /if \(phase === 'closing' \|\| phase === 'compact'\) return;\s*onClosing\?\.\(\);/);
  assert.match(source, /data-identity-dossier-scroll/);
  assert.match(source, /closeRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /event\.key !== 'Tab'/);
  assert.match(source, /!node\.closest\('\[inert\]'\)/);
  assert.match(source, /event\.preventDefault\(\); last\?\.focus\(\)/);
  assert.match(source, /event\.preventDefault\(\); first\?\.focus\(\)/);
});

test('grows one source card directly into one rack without a split image or intermediate handoff', () => {
  assert.match(source, /phase === 'starting' \? originRectangle : phase === 'closing' \? returnRectangle : layout\.rack/);
  assert.match(source, /lattice-production-identity-dossier__source-summary/);
  assert.equal((source.match(/lattice-production-identity-dossier__shared-avatar/g) || []).length, 1);
  assert.doesNotMatch(source, /function ProfileAvatar/);
  assert.match(source, /sourceIdentity\?\.avatarUrl \|\| preloadedProfileImageUrl/);
  assert.doesNotMatch(source, /data-shape=\{model\.profile\.avatarShape\}/);
  assert.match(source, /lattice-production-identity-dossier__source-copy/);
  assert.match(source, /if \(!persistent\) \{ onClosed\?\.\(\); return; \}\s*setPhase\('compact'\)/);
  assert.match(source, /if \(phase !== 'compact'\) return;\s*compactControlRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(source, /data-persistent=\{persistent \|\| undefined\}/);
  assert.match(source, /disabled=\{!compact\} onClick=\{requestOpen\}/);
  assert.doesNotMatch(source, /className="lattice-profile-rail__identity-copy"/);
  assert.match(styles, /__shared-avatar[^}]*transition: top 420ms/);
  assert.match(styles, /__shared-avatar[^}]*clip-path: circle\(50% at 50% 50%\)/);
  assert.match(styles, /__shared-avatar[^}]*top: 14px; left: 14px/);
  assert.match(styles, /__shared-avatar[^}]*background: transparent/);
  assert.match(styles, /__source-summary[^}]*padding: 14px 14px 14px 84px/);
  assert.match(styles, /__source-summary[^}]*background: transparent/);
  assert.match(styles, /\[data-phase="compact"\] \.lattice-production-identity-dossier__source-summary \{[^}]*opacity: 1;[^}]*pointer-events: auto/);
  assert.match(styles, /\.lattice-production-identity-dossier \{[^}]*background: var\(--lattice-menu-panel\)/);
  assert.doesNotMatch(styles, /:not\(\[data-phase="open"\]\) \.lattice-production-identity-dossier/);
  assert.match(styles, /\[data-source-compact\]:is\(\[data-phase="starting"\], \[data-phase="compact"\], \[data-phase="closing"\]\) \.lattice-production-identity-dossier \{[^}]*border: 0;[^}]*background: transparent/);
  assert.match(styles, /\[data-source-compact\] \.lattice-production-identity-dossier__shared-avatar \{[^}]*top: 6px;[^}]*left: 5px;[^}]*width: 36px;[^}]*height: 36px/);
  assert.match(styles, /:is\(\[data-phase="opening"\], \[data-phase="open"\]\) \.lattice-production-identity-dossier__source-summary \{[^}]*top: 78px;[^}]*left: 92px/);
  assert.doesNotMatch(styles, /lattice-identity-source-(?:return|depart)/);
  assert.doesNotMatch(source, /__identity">[\s\S]*?<h2>/);
  assert.match(styles, /data-source-compact[^}]*__shared-avatar/);
  assert.match(styles, /lattice-production-identity-dossier__source-summary[^}]*pointer-events: none/);
  assert.doesNotMatch(source, /layout\.(?:handoff|handoffAvatar|handoffRack|artwork)/);
  assert.doesNotMatch(source, /lattice-production-identity-viewer__(?:card-handoff|artwork)/);
  assert.doesNotMatch(styles, /scaleX|scaleY|identity-collapse/);
  assert.match(styles, /left 420ms/);
  assert.match(styles, /width 420ms/);
  assert.match(source, /const IDENTITY_TRANSITION_MS = 420/);
});

test('keeps three ordered modules in one controlled, numerically animated track', () => {
  assert.match(source, /label: 'Profile'[\s\S]*label: 'Links'[\s\S]*label: 'Technical'/);
  assert.match(source, /useState\('profile'\)/);
  assert.match(source, /setActiveSection\(section\.id\)/);
  assert.match(source, /<DisclosureModule active=\{active\}/);
  assert.match(disclosure, /aria-expanded=\{active\}/);
  assert.match(disclosure, /hidden=\{!active\}/);
  assert.doesNotMatch(source, /--lattice-identity-module-(?:y|clip-bottom)/);
  assert.doesNotMatch(styles, /__module\s*\{[^}]*clip-path/s);
  assert.match(source, /createDisclosureModuleTracks\(/);
  assert.match(disclosure, /style=\{style\}/);
  assert.match(styles, /__module\s*\{[^}]*position: absolute[^}]*transition: top 320ms[^;}]*height 320ms/s);
  assert.doesNotMatch(styles, /flex-basis/);
  assert.match(styles, /__modules \{[^}]*position: relative;[^}]*border: 1px solid var\(--lattice-menu-line-strong\)/);
  assert.match(styles, /__module \+ \.lattice-production-identity-dossier__module \{ border-top: 1px solid var\(--lattice-menu-line-strong\)/);
});

test('computes contiguous disclosure tracks without auto-sized handoffs', () => {
  const sections = [{ id: 'profile' }, { id: 'links' }, { id: 'technical' }];
  assert.deepEqual([...createDisclosureModuleTracks(sections, 'links', 600, 53).entries()], [
    ['profile', { height: 53, top: 0 }],
    ['links', { height: 494, top: 53 }],
    ['technical', { height: 53, top: 547 }],
  ]);
});

test('reveals natural panel geometry inside one bounded disclosure track', () => {
  assert.doesNotMatch(source, /--lattice-identity-panel-height/);
  assert.match(styles, /contain: layout paint style/);
  assert.match(styles, /__panel\s*\{[^}]*flex:\s*1 1 auto/);
});

test('inherits shared theme and typography roles with scrollable long-form content and reduced motion', () => {
  assert.match(styles, /background: var\(--lattice-menu-panel\)/);
  assert.match(styles, /color: var\(--lattice-menu-ink\)/);
  for (const role of ['module', 'label', 'value']) {
    assert.match(styles, new RegExp(`--lattice-window-type-${role}`));
  }
  assert.match(styles, /"Inscape Sora", sans-serif/);
  assert.match(styles, /"Inscape IBM Plex Sans Condensed", "Arial Narrow", sans-serif/);
  assert.match(styles, /overscroll-behavior: contain/);
  assert.match(styles, /white-space: pre-wrap/);
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styles, /aspect-ratio|16\s*\/\s*9/);
  assert.match(styles, /background-image: linear-gradient\(var\(--lattice-identity-overlay-grid\)/);
  assert.match(styles, /\[data-grid-visible="false"\][^{]*__veil \{ background-image: none; \}/);
  assert.match(styles, /background-color: color-mix\(in srgb, var\(--lattice-identity-workspace-surface, var\(--lattice-menu-panel\)\) 92%, transparent\)/);
  assert.doesNotMatch(styles, /palette|metadata-color/);
});
