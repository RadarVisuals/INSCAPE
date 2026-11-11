import test from 'node:test';
import assert from 'node:assert/strict';
import { createArticle } from './domain/article.js';
import { parseArticleBackup, serializeArticleBackup, ARTICLE_BACKUP_FILE_LIMIT } from './articleBackup.js';

test('portable article backup round trips old and styled articles without rewriting them', () => {
  for (const styled of [false, true]) {
    const article = createArticle('My article');
    if (styled) article.appearance.textStyles = { h2: { fontSize: 32 }, caption: { color: '#abcdef' } };
    else delete article.appearance;
    const source = serializeArticleBackup(article), restored = parseArticleBackup(source);
    assert.deepEqual(restored, article); assert.notEqual(restored, article);
    assert.deepEqual(parseArticleBackup(JSON.stringify(article, null, 2)), article);
    assert.equal(JSON.stringify(article), source);
  }
});
test('backup import rejects corrupt, oversized, unsupported and unsafe data', () => {
  const article = createArticle();
  article.content.content[0].content = [{ type: 'text', text: 'unsafe', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }];
  for (const source of ['broken', '{}', 'null', JSON.stringify({ ...createArticle(), version: 2 }), JSON.stringify(article), ' '.repeat(ARTICLE_BACKUP_FILE_LIMIT + 1)]) {
    assert.throws(() => parseArticleBackup(source));
  }
});
