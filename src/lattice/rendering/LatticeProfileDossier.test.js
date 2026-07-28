import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./LatticeProfileDossier.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./latticeProfileArchiveDossier.css', import.meta.url), 'utf8');

test('profile dossier renders only the injected public presentation contract', () => {
  assert.match(source, /selectPublicProfilePresentation\(presentation\)/);
  assert.match(source, /INSCAPE \/ UNIVERSAL PROFILES ARCHIVE/);
  assert.match(source, /lattice-profile-archive__emblem/);
  assert.match(source, /lattice-profile-archive__portrait/);
  assert.match(source, /lattice-profile-archive__classification/);
  assert.match(source, /lattice-profile-archive__stats/);
  assert.match(source, /PUBLIC PROJECTION/);
  assert.match(source, /profile\.counts\.assets/);
  assert.doesNotMatch(source, /RADAR|INSCAPE FIXTURE|VXCTXR|RESIDENT ZERO|PFP\.webp|asset count|collection count|last seen|last published/iu);
  assert.doesNotMatch(source, /useWalletStore|useLibraryStore|localStorage|sessionStorage|indexedDB|profileDocument/);
});

test('dossier open, close, Escape and actions remain controlled by the caller', () => {
  assert.match(source, /open = false/);
  assert.match(source, /event\.key !== 'Escape'/);
  assert.match(source, /onRequestClose\?\.\(\)/);
  assert.match(source, /closeRef\.current\?\.focus/);
  assert.match(source, /inert=\{!open \? '' : undefined\}/);
  assert.match(source, /onCopyAddress\?\.\(profile\.official\.address\)/);
  assert.match(source, /onShare\?\.\(profile\.workspaceUrl\)/);
});

test('dossier is a fixed responsive overlay with restrained motion and no lattice reflow', () => {
  assert.match(styles, /\.lattice-profile-dossier-layer\s*\{[^}]*position: fixed;[^}]*inset: 0;[^}]*place-items: center;/s);
  assert.match(styles, /\.lattice-profile-archive\s*\{[^}]*aspect-ratio: 16 \/ 9;[^}]*grid-template-rows: 48px minmax\(0, 1fr\) 36px;/s);
  assert.match(styles, /background-image:[^;]*linear-gradient/s);
  assert.match(styles, /\.lattice-profile-archive__body\s*\{[^}]*grid-template-columns: 37% 63%;/s);
  assert.match(styles, /@media \(max-width: 700px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /\.lattice-profile-dossier-layer\s*\{[^}]*place-items: center;[^}]*padding: 48px;/s);
  assert.doesNotMatch(styles, /padding: 48px 48px 48px 304px/);
  assert.doesNotMatch(styles, /margin-left: 1120px|padding-left: 1120px/);
});
