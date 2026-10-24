import { createProfileDocumentV9AssetResolver } from '../src/profileDocument/domain/profileDocumentV9Asset.js';
import { OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS } from '../src/public/ownerSystemWorkflow/ownerSystemWorkflowDevelopmentFixture.js';
import { createArticle } from '../src/text/domain/article.js';

export function sampleArticle(mode = 'display') {
  const article = createArticle(mode === 'article' || mode === 'readonly' ? 'A quiet place' : '');
  article.appearance = { ...article.appearance, background: null, color: '#232c26', fontSize: 15 };
  const paragraph = (text) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
  article.content.content =
    mode === 'empty'
      ? [{ type: 'paragraph' }]
      : mode === 'display'
        ? [paragraph('A quiet place')]
        : [
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'Space to explore' }],
            },
            paragraph(
              'Light moves across the room. A small detail becomes the beginning of a story.',
            ),
            paragraph('Select a few words and try the tools. Your changes stay in this example.'),
          ];
  if (mode === 'illustrated') {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="288" height="144" viewBox="0 0 288 144"><rect width="288" height="144" fill="#c5c1b5"/><circle cx="230" cy="35" r="22" fill="#f0ece1"/><path d="M30 144V75a48 48 0 0 1 96 0v69Z" fill="#a99b85"/><path d="M116 144V113a55 55 0 0 1 110 0v31Z" fill="#586657"/></svg>';
    const url = 'data:image/svg+xml;base64,' + btoa(svg);
    const source = {
      ...OWNER_SYSTEM_WORKFLOW_REVIEW_ASSETS[2],
      imageUrl: url,
      originalImageUrl: url,
      thumbnailUrl: url,
    };
    const asset = createProfileDocumentV9AssetResolver([source])(source.id);
    article.content.content.splice(1, 0, {
      type: 'artwork',
      attrs: { asset, alt: 'Local composition study', caption: 'Light, shape and space.' },
    });
  }
  return article;
}

export function articlePlainText(article) {
  const visit = (node) =>
    node.text || (node.content || []).map(visit).join(node.type === 'doc' ? '\n' : '');
  return article ? visit(article.content) : '';
}

// Text owns its article; shared Color/FX edit that same appearance, not a copy.
export function patchPreviewItem(item, patch) {
  if (item.kind !== 'text') return { ...item, ...patch };
  const { color, grain, ...rest } = patch;
  const article = rest.article || item.article;
  const appearance = { ...article.appearance };
  if (color !== undefined) appearance.color = color;
  if (grain !== undefined)
    appearance.edges = {
      corners: [0, 0, 0, 0],
      shadow: false,
      ...appearance.edges,
      grain: grain / 100,
    };
  return { ...item, ...rest, article: { ...article, appearance } };
}
