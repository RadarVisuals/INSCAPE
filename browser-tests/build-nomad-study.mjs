import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { nomadStudy } from './fixtures/nomad-study.mjs';

const sourcePath = '../../nomad-webp-svg/NOMAD-animated.svg';
const source = await readFile(sourcePath, 'utf8');
const output = 'output/nomad-performance-study-2026-10-21';
await mkdir(output, { recursive: true });
const hash = data => createHash('sha256').update(data).digest('hex');
const files = [];
for (const fps of [60, 30]) {
  const svg = nomadStudy(source, { fps, probe: false });
  assert.deepEqual(svg.match(/<image\b[^>]+>/g), source.match(/<image\b[^>]+>/g));
  assert.ok(!svg.includes('nomadPerf'), 'shipping trial has no measuring hooks');
  const script = svg.match(/<script[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/script>/)?.[1];
  assert.ok(script); new Function(script);
  const name = `NOMAD-${fps}fps-trial.svg`;
  await writeFile(`${output}/${name}`, svg);
  files.push({ name, fps, bytes: Buffer.byteLength(svg), sha256: hash(svg) });
}
await writeFile(`${output}/manifest.json`, JSON.stringify({ sourcePath, sourceSha256: hash(source),
  defaultMode: 'fly', wind: .35, oversampling: 1.5, files,
  changes: 'Separate experiments: limit drawing only; flight simulation, cloth shader, 39 source images, layer ordering and resolution remain intact.',
  limitations: 'Not installed in Inscape. Original authoring controls and original explicit Play after reduced motion are retained. No v1 settings integration is added.' }, null, 2));
console.log(output);
