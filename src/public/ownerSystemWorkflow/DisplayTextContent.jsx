import { ARTICLE_FONTS, articleAlignmentStyle, textSurfaceStyle } from '../../text/domain/article.js';
import ArticleView from '../../text/ArticleView.jsx';
import '../../text/fonts.css';
import './displayText.css';
import './moduleSurface.css';

export default function DisplayTextContent({ placement, cellSize, children }) {
  const { text, transform } = placement;
  const rotated = transform.quarterTurns % 2 === 1;
  if (text.article) return <div className="display-text-content display-text-content--article" data-module-edges={Boolean(text.article.appearance?.edges) || undefined} style={{
    position: 'absolute', left: '50%', top: '50%',
    width: (rotated ? placement.rowSpan : placement.columnSpan) * cellSize,
    height: (rotated ? placement.columnSpan : placement.rowSpan) * cellSize,
    ...textSurfaceStyle(text.article),
    transform: `translate(-50%, -50%) rotate(${transform.quarterTurns * 90}deg) scale(${transform.mirrorX ? -1 : 1}, ${transform.mirrorY ? -1 : 1})`,
  }}><div style={{ zoom: cellSize / 30 }}>{children || <ArticleView article={text.article} />}</div>{text.article.appearance?.edges && <span aria-hidden="true" className="module-surface-grain" />}</div>;
  return <div className="display-text-content" style={{
    position: 'absolute', left: '50%', top: '50%',
    width: (rotated ? placement.rowSpan : placement.columnSpan) * cellSize,
    height: (rotated ? placement.columnSpan : placement.rowSpan) * cellSize,
    fontFamily: ARTICLE_FONTS.find(font => font.id === text.font).family,
    fontSize: text.size * cellSize / 30, color: text.color,
    fontWeight: text.bold ? 700 : 400, fontStyle: text.italic ? 'italic' : 'normal',
    ...articleAlignmentStyle(text.alignment),
    transform: `translate(-50%, -50%) rotate(${transform.quarterTurns * 90}deg) scale(${transform.mirrorX ? -1 : 1}, ${transform.mirrorY ? -1 : 1})`,
  }}>{text.content}</div>;
}
