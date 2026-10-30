import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { prepareNomadLoading } from './fixtures/nomad-loading.mjs';

const sourcePath = '../../nomad-webp-svg/NOMAD-animated.svg';
const output = 'output/nomad-loading-2026-10-21';
const source = await readFile(sourcePath, 'utf8');
const result = prepareNomadLoading(source);
const images = svg => svg.match(/<image\b[^>]+>/g);
assert.equal(images(result).length, 39);
assert.deepEqual(images(result), images(source));
assert.equal(result.match(/<metadata>[\s\S]*?<\/metadata>/)?.[0], source.match(/<metadata>[\s\S]*?<\/metadata>/)?.[0]);
const hash = value => createHash('sha256').update(value).digest('hex');
await mkdir(output, { recursive: true });
await writeFile(output + '/NOMAD-incremental-loading.svg', result);
await writeFile(output + '/build.json', JSON.stringify({ source: sourcePath, sourceSha256: hash(source),
  outputSha256: hash(result), bytes: Buffer.byteLength(result), images: 39,
  preserved: ['image elements and bytes', 'layer order and bounds', 'rig', 'controls', 'animation clock', 'metadata and density limits'],
  change: 'Decode each layer immediately before upload and yield between upload batches. Cancel on disposal/context loss.',
}, null, 2));
console.log(output + '/NOMAD-incremental-loading.svg');
