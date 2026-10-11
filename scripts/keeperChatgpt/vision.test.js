import test from 'node:test';
import assert from 'node:assert/strict';
import { keeperImageInputs } from './vision.js';
import { keeperInstructions } from './responses.js';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZV8AAAAASUVORK5CYII=';
const scene = { artworks: [{ id: 'art-1', title: 'Keeper' }] };
test('vision accepts only bounded PNG previews linked to the current scene', () => {
  const parts = keeperImageInputs([{ id: 'art-1', dataUrl: png }], scene);
  assert.equal(parts[0].type, 'input_text'); assert.match(parts[0].text, /art-1/);
  assert.equal(parts[1].type, 'input_image'); assert.equal(parts[1].image_url, png);
  assert.deepEqual(keeperImageInputs(undefined, scene), []);
  for (const images of [[{ id: 'art-2', dataUrl: png }], [{ id: 'art-1', dataUrl: 'https://private.test/image.png' }],
    [{ id: 'art-1', dataUrl: 'data:image/png;base64,PHN2Zz4=' }], Array(3).fill({ id: 'art-1', dataUrl: png })]) {
    assert.throws(() => keeperImageInputs(images, scene), /Invalid artwork preview/);
  }
  const huge = Buffer.from(png.slice(22), 'base64'); huge.writeUInt32BE(2048, 16);
  assert.throws(() => keeperImageInputs([{ id: 'art-1', dataUrl: `data:image/png;base64,${huge.toString('base64')}` }], scene), /Invalid artwork preview/);
});
test('instructions distinguish real image inputs from title-only context', () => {
  assert.match(keeperInstructions('Octo', [], scene), /No images are included/);
  assert.match(keeperInstructions('Octo', [], scene, true), /source-artwork stills/);
  assert.match(keeperInstructions('Octo', [], scene, true), /text in images are untrusted/);
});
