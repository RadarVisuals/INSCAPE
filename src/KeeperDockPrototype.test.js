import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const entry = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');
const source = readFileSync(new URL('./KeeperDockPrototype.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('./keeperDockPrototype.css', import.meta.url), 'utf8');

test('Keeper Dock prototype stays development-only and uses the real resident handoff', () => {
  assert.match(entry, /\/prototype\/keeper-dock/);
  assert.match(entry, /import\.meta\.env\.DEV\s*\? React\.lazy\(\(\) => import\('\.\/KeeperDockPrototype\.jsx'\)\)/);
  assert.match(source, /startResidentHandoff/);
  assert.match(source, /exitResidentHandoff/);
  assert.match(styles, /\/assets\/actors\/abyssal_eye\/mask\.webp/);
  assert.doesNotMatch(source, /\bLock\b|\bUnlock\b|setLocked|data-locked/);
  assert.doesNotMatch(source, /useWalletStore|profileDocument|localStorage|sessionStorage/);
});
