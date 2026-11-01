import { assertArticle, ARTICLE_MAX_BYTES } from './domain/article.js';

// A portable article, not an account/draft export. No module IDs, visibility,
// wallet state or Display links enter the file. Artwork stays referenced.
export const ARTICLE_BACKUP_FILE_LIMIT = ARTICLE_MAX_BYTES * 6;
export const serializeArticleBackup = article => JSON.stringify(article);
export function parseArticleBackup(source) {
  if (new TextEncoder().encode(source).length > ARTICLE_BACKUP_FILE_LIMIT) throw new Error('This backup file is too large.');
  let article;
  try { article = JSON.parse(source); } catch { throw new Error('Choose a valid INSCAPE article JSON backup.'); }
  return structuredClone(assertArticle(article));
}
