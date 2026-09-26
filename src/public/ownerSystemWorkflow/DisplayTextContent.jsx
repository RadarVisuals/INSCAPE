import { ARTICLE_FONTS, articleAlignmentStyle, textSurfaceStyle } from '../../text/domain/article.js';
import { useContext } from 'react';
import { DisplayStageSizeContext } from './DisplayStageSizeContext.js';
import ArticleView from '../../text/ArticleView.jsx';
import '../../text/fonts.css';
import './displayText.css';
import './moduleSurface.css';

export default function DisplayTextContent({ placement, cellSize,
  width = placement.columnSpan * cellSize, height = placement.rowSpan * cellSize, children }) {
  const stageSize = useContext(DisplayStageSizeContext);
  const { text, transform } = placement;
  const rotated = transform.quarterTurns % 2 === 1;
  const [cos, sin] = [[1, 0], [0, 1], [-1, 0], [0, -1]][transform.quarterTurns];
  const mirrorX = transform.mirrorX ? -1 : 1, mirrorY = transform.mirrorY ? -1 : 1;
  const a = cos * mirrorX, b = sin * mirrorX, c = -sin * mirrorY, d = cos * mirrorY;
  // Anchor the transformed surface to the placement's painted endpoints.
  // A 50% origin/translation can rasterize at half pixels for odd dimensions.
  const surface = { position: 'absolute', left: 0, top: 0,
    width: rotated ? height : width, height: rotated ? width : height,
    transformOrigin: '0 0',
    transform: `matrix(${a}, ${b}, ${c}, ${d}, ${a < 0 || c < 0 ? width : 0}, ${b < 0 || d < 0 ? height : 0})` };
  if (text.article) return <div className="display-text-content display-text-content--article" data-module-edges={Boolean(text.article.appearance?.edges) || undefined} style={{
    ...surface,
    ...textSurfaceStyle(text.article, stageSize?.contentScale ?? 1),
  }}><div style={{ zoom: cellSize / 30, width: (rotated ? placement.rowSpan : placement.columnSpan) * 30 }}>{children || <ArticleView article={text.article} />}</div>{text.article.appearance?.edges && <span aria-hidden="true" className="module-surface-grain" />}</div>;
  return <div className="display-text-content" style={{
    ...surface,
    fontFamily: ARTICLE_FONTS.find(font => font.id === text.font).family,
    fontSize: text.size * cellSize / 30, color: text.color,
    fontWeight: text.bold ? 700 : 400, fontStyle: text.italic ? 'italic' : 'normal',
    ...articleAlignmentStyle(text.alignment),
  }}>{text.content}</div>;
}
