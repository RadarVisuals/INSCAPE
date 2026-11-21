import test from 'node:test';
import assert from 'node:assert/strict';
import { receptionFluidText } from './receptionFluidText.js';
const quote = (size = 28) => ({ title: '', appearance: { fontSize: 16, scale: 1, compact: true, color: '#fff' },
  content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'People think I am the grim reaper.',
    marks: [{ type: 'textStyle', attrs: { fontSize: size } }] }] }] } });
test('inline formatted quote scales with its own width and stops at a readable floor without writes', () => {
  const article = quote(), saved = structuredClone(article);
  assert.equal(receptionFluidText(article, 624, 624), article);
  assert.equal(receptionFluidText(article, 800, 624), article);
  assert.equal(receptionFluidText(article, 468, 624).appearance.scale, .75);
  const mobile = receptionFluidText(article, 320, 624);
  assert.equal(mobile.appearance.scale * 28, 16);
  assert.equal(mobile.content, article.content);
  assert.deepEqual(article, saved);
  assert.equal(receptionFluidText(article, 0, 624), article);
});
test('small authored text is preserved and zoom participates in the readable floor', () => {
  const small = quote(12); assert.equal(receptionFluidText(small, 200, 600), small);
  const article = quote(28); article.appearance.scale = 2;
  assert.equal(receptionFluidText(article, 100, 600).appearance.scale * 28, 16);
});
test('heading roles, mixed writing and article titles retain their relative hierarchy', () => {
  const article = quote(24); article.title = 'Nomad'; article.appearance.titleFontSize = 48;
  article.content.content.push({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Title' }] });
  article.appearance.textStyles = { h1: { fontSize: 80 } };
  const result = receptionFluidText(article, 300, 600);
  assert.equal(result.appearance.scale, 16 / 24);
  assert.equal(result.appearance.titleFontSize, 48);
  assert.equal(result.appearance.textStyles, article.appearance.textStyles);
});
