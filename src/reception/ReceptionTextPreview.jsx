import { useRef } from 'react';
import ArticleView from '../text/ArticleView.jsx';
import useTextExcerpt from '../text/useTextExcerpt.js';

export default function ReceptionTextPreview({ article, id, singleLine = false, clipBounds, onOverflow }) {
  const host = useRef(null), content = useRef(null);
  const clip = useTextExcerpt(host, content, { article, id, singleLine, clipBounds, onOverflow });
  return <div ref={host} className="reception-text-preview" data-stacked={!singleLine && article.appearance?.writingDirection === 'stacked' || undefined}
    data-text-single-line={singleLine || undefined} data-overflow={clip.overflow || undefined}>
    <div className="reception-text-excerpt" style={{ height: clip.horizontal ? '100%' : clip.size ?? '100%',
      width: clip.horizontal ? clip.size ?? '100%' : undefined, ...clip.style }}>
      <div ref={content}><ArticleView article={article} /></div>
    </div>
  </div>;
}
