import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = '.browser-test-runtime/nomad-export-study', out = 'docs/audits/2026-10-21/nomad-export-comparison';
await mkdir(out, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const baseline = JSON.parse(await readFile(base + '/preservation-before.json', 'utf8'));
const allowed = new Set(['browser-tests/filled-workbench-performance.mjs', 'browser-tests/filled-workbench-performance-fixture.jsx']);
const preservation = [];
for (const [name, before] of Object.entries(baseline)) {
  assert.ok(!name.includes('INSCAPE_ALPHA_CONTINUATION_HANDOFF'));
  let current = null; try { current = hash(await readFile(name)); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  preservation.push({ file: name, before, after: current, unchanged: before === current });
  if (!allowed.has(name)) assert.equal(current, before, 'Existing work changed: ' + name);
}
const summary = JSON.parse(await readFile(base + '/benchmark/summary.json', 'utf8'));
assert.equal(summary.summary.length, 10); assert.ok(summary.summary.every(s => s.runs === 3));
const quality = JSON.parse(await readFile(base + '/quality/results.json', 'utf8')); assert.equal(quality.evidence.length, 15);
const exports = [];
for (const variant of ['full', 'half', 'quarter', 'vector', 'loop']) {
  const file = `output/nomad-export-study-2026-10-21/NOMAD-${variant}.svg`, bytes = await readFile(file);
  assert.ok(!bytes.toString().includes('window.nomadPerf'));
  exports.push({ variant, file, bytes: bytes.length, sha256: hash(bytes) });
  await copyFile(`${base}/quality/${variant}-800-1-pose.png`, `${out}/${variant}-wide.png`);
  await copyFile(`${base}/quality/${variant}-320-2-pose.png`, `${out}/${variant}-dense.png`);
}
for (const [from, to] of [['benchmark/results.json','benchmark.json'],['benchmark/summary.json','summary.json'],
  ['quality/results.json','quality.json'],['quality/pixel-comparisons.json','pixel-comparisons.json'],
  ['preview/results.json','preview.json'],['preview/compare-1440.png','preview-wide.png'],['preview/compare-390.png','preview-narrow.png'],
  ['loop/manifest.json','loop.json'],['benchmark/export-half-4-30.png','filled-workbench.png']]) await copyFile(`${base}/${from}`, `${out}/${to}`);
await copyFile('output/nomad-export-study-2026-10-21/conversion.json', out + '/conversion.json');
await writeFile(out + '/preservation.json', JSON.stringify(preservation, null, 2));
await writeFile('output/nomad-export-study-2026-10-21/manifest.json', JSON.stringify({ exports,
  sourceSha256: baseline['../../nomad-webp-svg/NOMAD-animated.svg'],
  status: 'Local experimental copies; production and original artwork unchanged',
  benchmark: '30 filled-Workbench runs, three per variant and active count',
  limitations: { vector: 'Backings traced; nonlinear warp approximated with control points; layer tint disabled',
    loop: '512x568, 30fps cloth, 60fps live flight; fixed wind and cloth speed; pause uses poster, resume restarts loop; altered frequencies close 8s seam' } }, null, 2));
console.log(JSON.stringify({ preserved: preservation.filter(p => p.unchanged).length,
  intentionallyExtended: preservation.filter(p => !p.unchanged).map(p => p.file), exports }, null, 2));
