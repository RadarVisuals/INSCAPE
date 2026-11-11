import test from 'node:test';
import assert from 'node:assert/strict';
import { transformAsync } from '@babel/core';
import { resolve } from 'node:path';
import plugin, { designMetadataEnabled } from './designMetadata.js';

const root = resolve(import.meta.dirname, '..');
const transform = (code, file) => transformAsync(code, { filename: resolve(root, file), configFile: false, babelrc: false,
  parserOpts: { plugins: ['jsx'] }, plugins: [[plugin, { root }]] });

test('source hints identify host elements and the component across map callbacks', async () => {
  const { code } = await transform('export const Card = () => <section>{[1].map(i => <button key={i}>Go</button>)}<Other /></section>;', 'src/Card.jsx');
  assert.equal((code.match(/data-inscape-owner="Card"/gu) || []).length, 2);
  assert.match(code, /data-inscape-source="src\/Card.jsx:1"/u);
  assert.match(code, /<Other\s*\/>/u);
  assert.ok(!code.includes(root));
});
test('dependencies and normal or production modes are not instrumented', async () => {
  assert.equal(designMetadataEnabled('serve', 'design-lab'), true);
  for (const [command, mode] of [['build', 'production'], ['build', 'design-lab'], ['serve', 'development']]) assert.equal(designMetadataEnabled(command, mode), false);
  const { code } = await transform('const Card = () => <button />;', 'node_modules/example/index.jsx');
  assert.ok(!code.includes('data-inscape-'));
});
