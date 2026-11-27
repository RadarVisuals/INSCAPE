import test from 'node:test';
import assert from 'node:assert/strict';
import { assertArticle, createArticle } from './domain/article.js';
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

test('unchanged immutable articles remain valid while edited copies still enforce content and byte limits', () => {
  const article = freeze(createArticle('Frozen article'));
  assert.equal(assertArticle(article), article);
  assert.equal(assertArticle(article), article);
  for (const content of [
    { type: 'doc', content: [{ type: 'script' }] },
    { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'é'.repeat(100000) }] }] },
  ]) assert.throws(() => assertArticle({ ...article, content }));
  assert.equal(assertArticle(article), article, 'invalid edits cannot poison the accepted article');
});

test('freezing the article shell does not hide later mutations of its children', () => {
  const article = Object.freeze(createArticle('Outer freeze'));
  assertArticle(article);
  article.content.content[0].type = 'script';
  assert.throws(() => assertArticle(article));
  article.content.content[0].type = 'paragraph';
  assertArticle(article);
  article.appearance.fontSize = -1;
  assert.throws(() => assertArticle(article));
});

test('frozen accessors and custom prototypes cannot reuse an obsolete validation result', () => {
  let title = 'Initially valid';
  const accessor = createArticle();
  Object.defineProperty(accessor, 'title', { enumerable: true, get: () => title });
  freeze(accessor); assertArticle(accessor);
  title = 'x'.repeat(161); assert.throws(() => assertArticle(accessor));
  let serialized = 'Short';
  const prototype = { toJSON() { return serialized; } };
  const custom = Object.assign(Object.create(prototype), createArticle('Custom'));
  freeze(custom); assertArticle(custom);
  serialized = 'x'.repeat(200000); assert.throws(() => assertArticle(custom));
});
