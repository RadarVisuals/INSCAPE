import { createElement, useEffect, useState } from 'react';
import { ARTICLE_FONTS, assertArticle, articleAlignmentStyle, textAppearance, textContentStyle } from './domain/article.js';
import { resolvePublishedAssetUrl } from '../profileDocument/domain/publishedAssetUrl.js';
import './text.css';

export function ArticleArtwork({ attrs }) {
  const { asset, alt, caption } = attrs;
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => setUnavailable(false), [asset.media.url]);
  return <figure>{unavailable ? <p role="status">Artwork unavailable.</p>
    : <img src={resolvePublishedAssetUrl(asset.media.url)} alt={alt} loading="lazy" onError={() => setUnavailable(true)} />}
    {caption && <figcaption>{caption}</figcaption>}
    </figure>;
}
function renderNode(node, key) {
  if (node.type === 'text') return (node.marks || []).reduce((text, mark, index) => {
    const id = `${key}-m${index}`;
    if (mark.type === 'textStyle') return <span key={id} style={{ fontFamily: mark.attrs.fontFamily }}>{text}</span>;
    if (mark.type === 'link') return <a key={id} href={mark.attrs.href} target="_blank" rel="noopener noreferrer">{text}</a>;
    return createElement(({ bold: 'strong', italic: 'em', underline: 'u', strike: 's', code: 'code' })[mark.type], { key: id }, text);
  }, node.text);
  if (node.type === 'artwork') return <ArticleArtwork key={key} attrs={node.attrs} />;
  const tag = ({ doc: 'div', paragraph: 'p', heading: `h${node.attrs?.level}`, bulletList: 'ul', orderedList: 'ol', listItem: 'li', blockquote: 'blockquote', horizontalRule: 'hr', hardBreak: 'br' })[node.type];
  return createElement(tag, { key, ...(['paragraph', 'heading'].includes(node.type) ? { style: articleAlignmentStyle(node.attrs?.textAlign) } : {}), ...(node.type === 'orderedList' ? { start: node.attrs?.start } : {}) },
    ['hardBreak', 'horizontalRule'].includes(node.type) ? undefined : node.content?.length ? node.content.map((n, i) => renderNode(n, `${key}-${i}`)) : <br />);
}
export default function ArticleView({ article }) {
  try { assertArticle(article); } catch (e) { return <p role="alert">{e.message}</p>; }
  const appearance = textAppearance(article);
  return <article className={`text-document${appearance.compact ? ' text-document--compact' : ''}`} style={{ ...textContentStyle(article), fontFamily: ARTICLE_FONTS.find(f => f.id === article.font).family, fontSize: appearance.fontSize, color: article.appearance ? appearance.color : 'inherit', zoom: appearance.scale }}>
    {article.title && <h1 className="text-document-title" style={{ fontSize: appearance.titleFontSize ?? 28 }}>{article.title}</h1>}{renderNode(article.content, 'article')}
  </article>;
}
