import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./LatticeProductionIdentityDossier.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./latticeProductionIdentityDossier.css', import.meta.url), 'utf8');

test('uses a body portal with reversible inert ownership, reliable closing, and a manual focus trap', () => {
  assert.match(source, /createPortal\(<section/);
  assert.match(source, /document\.body\.children/);
  assert.match(source, /hadInert: node\.hasAttribute\('inert'\)/);
  assert.match(source, /else node\.removeAttribute\('inert'\)/);
  assert.match(source, /event\.key !== 'Escape'/);
  assert.match(source, /window\.addEventListener\('keydown', closeOnEscape, true\)/);
  assert.match(source, /setPhase\('opening'\)/);
  assert.match(source, /setPhase\('closing'\)/);
  assert.match(source, /phase === 'open' && event\.target === event\.currentTarget/);
  assert.match(source, /if \(phase === 'closing'\) return;\s*onClosing\?\.\(\);/);
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
  assert.match(styles, /lattice-production-identity-dossier__source-summary[^}]*pointer-events: none/);
  assert.doesNotMatch(source, /layout\.(?:handoff|handoffAvatar|handoffRack|artwork)/);
  assert.doesNotMatch(source, /lattice-production-identity-viewer__(?:card-handoff|artwork)/);
  assert.doesNotMatch(styles, /scaleX|scaleY|identity-collapse/);
  assert.match(styles, /left 420ms/);
  assert.match(styles, /width 420ms/);
});

test('keeps three ordered modules in place with exactly one controlled expanded section', () => {
  assert.match(source, /PROFILE MODULE[\s\S]*LINK MODULE[\s\S]*TECHNICAL MODULE/);
  assert.match(source, /useState\('profile'\)/);
  assert.match(source, /setActiveSection\(section\.id\)/);
  assert.match(source, /aria-expanded=\{active\}/);
  assert.match(source, /inert=\{!active \? '' : undefined\}/);
  assert.match(source, /--lattice-identity-module-y/);
  assert.match(styles, /transform: translate3d\(0, var\(--lattice-identity-module-y\), 0\)/);
  assert.match(styles, /will-change: transform, height/);
});

test('inherits shared theme and typography roles with scrollable long-form content and reduced motion', () => {
  assert.match(styles, /background: var\(--lattice-menu-panel\)/);
  assert.match(styles, /color: var\(--lattice-menu-ink\)/);
  for (const role of ['module', 'label', 'section', 'body', 'value']) {
    assert.match(styles, new RegExp(`--lattice-window-type-${role}`));
  }
  assert.match(styles, /overscroll-behavior: contain/);
  assert.match(styles, /white-space: pre-wrap/);
  assert.match(styles, /@media \(max-width: 640px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styles, /aspect-ratio|16\s*\/\s*9/);
  assert.match(styles, /background-image: linear-gradient\(var\(--lattice-identity-overlay-grid\)/);
  assert.match(styles, /background-color: color-mix\(in srgb, var\(--lattice-menu-panel\) 92%, transparent\)/);
  assert.doesNotMatch(styles, /palette|metadata-color/);
});
