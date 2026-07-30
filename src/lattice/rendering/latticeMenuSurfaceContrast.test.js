import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const menuStyles = readFileSync(new URL('./latticeMenuSurface.css', import.meta.url), 'utf8');
const viewerStyles = readFileSync(new URL('./latticeFocusViewer.css', import.meta.url), 'utf8');
const identityStyles = readFileSync(new URL('./latticeProductionIdentityDossier.css', import.meta.url), 'utf8');
const themes = {
  carbon: [[216, 215, 210], [16, 17, 17]], graphite: [[232, 231, 226], [48, 50, 50]],
  slate: [[243, 242, 237], [103, 104, 104]], ash: [[17, 19, 19], [221, 220, 214]],
  mist: [[17, 19, 19], [215, 211, 202]], paper: [[17, 19, 19], [239, 237, 230]],
};
const luminance = (rgb) => rgb.map((channel) => channel / 255)
  .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  .reduce((total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (first, second) => {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
};

test('viewer rack and legacy dossier text inherit owner-menu ink with AA contrast in every supported menu theme', () => {
  assert.match(menuStyles, /\.lattice-focus-viewer/);
  assert.match(viewerStyles, /dossier-body small,[\s\S]*color: var\(--lattice-menu-ink\)/u);
  assert.match(viewerStyles, /traits li[\s\S]*color: var\(--lattice-menu-ink\)/u);
  assert.match(viewerStyles, /rack-module > button[\s\S]*color: var\(--lattice-menu-ink\)/u);
  assert.match(viewerStyles, /rack-eyebrow[\s\S]*color: var\(--lattice-menu-ink\)/u);
  assert.match(viewerStyles, /rack-panel dt[\s\S]*color: var\(--lattice-menu-ink\)/u);
  assert.match(viewerStyles, /rack-attributes span[\s\S]*color: var\(--lattice-menu-ink\)/u);
  assert.match(identityStyles, /background: var\(--lattice-menu-panel\)/u);
  assert.match(identityStyles, /color: var\(--lattice-menu-ink\)/u);
  assert.match(identityStyles, /identity-dossier__technical dt[^}]*color: var\(--lattice-menu-ink\)/u);
  assert.match(identityStyles, /identity-dossier__links a small[^}]*color: var\(--lattice-menu-ink\)/u);
  for (const [theme, [ink, panel]] of Object.entries(themes)) {
    assert.ok(contrast(ink, panel) >= 4.5, `${theme} essential small-label contrast must be at least 4.5:1`);
  }
});
