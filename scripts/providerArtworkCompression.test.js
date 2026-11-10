import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { gzipSync } from 'node:zlib';
import { compressProviderArtwork, packedSvgExpression, providerArtworkCompressionPlugin } from './providerArtworkCompression.js';

test('reviewed provider artwork decodes byte-for-byte and retains its exact data URI', async () => {
  const code = await readFile(new URL('../node_modules/@lukso/up-provider/dist/index.mjs', import.meta.url), 'utf8');
  const literal = code.match(/var image = `([^`]+)`;/su)[0];
  const original = runInNewContext(`${literal}; image`);
  const expression = packedSvgExpression(original);
  const decoded = runInNewContext(expression);
  assert.equal(decoded, original);
  assert.equal(encodeURIComponent(decoded), encodeURIComponent(original));
  assert.ok(Buffer.byteLength(original) - Buffer.byteLength(expression) > 30000);
  assert.ok(gzipSync(expression).length <= gzipSync(literal).length + 1000);
  assert.equal(compressProviderArtwork(code).replace(/var image = [\s\S]*?;\nvar UniversalProfiles/u,
    'var image = REMOVED;\nvar UniversalProfiles'), code.replace(/var image = [\s\S]*?;\nvar UniversalProfiles/u,
    'var image = REMOVED;\nvar UniversalProfiles'), 'only the artwork initializer changes');
});

test('SDK drift fails the build and unrelated modules are untouched', () => {
  assert.throws(() => compressProviderArtwork('different SDK'), /review required/);
  assert.throws(() => packedSvgExpression('\ue000'), /reserved/);
  assert.equal(providerArtworkCompressionPlugin().transform('ordinary code', '/src/app.js'), null);
});
