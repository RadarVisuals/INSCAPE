import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('PixiEngine asset subscriptions consume canonical RenderConfig paths, not editor aliases', () => {
  const source = readFileSync(new URL('./PixiEngine.js', import.meta.url), 'utf8');
  const constructorBoundary = source.slice(source.indexOf('const reloadTriggerSelectors'), source.indexOf('// Detect transaction trigger reactions'));

  assert.match(constructorBoundary, /state => state\.renderConfig\?\.actor\.id/);
  assert.match(constructorBoundary, /state => state\.renderConfig\?\.scene\.background\.patternStyle/);
  for (const alias of ['characterId', 'bgClippingMaskId', 'bgPatternStyle', 'bgMountainId', 'bgMountainBackId']) {
    assert.doesNotMatch(constructorBoundary, new RegExp(`['\"]${alias}['\"]`));
  }
});
