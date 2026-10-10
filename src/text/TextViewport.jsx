import { useLayoutEffect, useRef } from 'react';
import { TextFrameOverflow, useTextFrame, useLinkedFrameLayout } from './TextFrame.jsx';
import ArticleView from './ArticleView.jsx';

// Automatic end spacing may yield to a fitting article. Explicit article padding
// remains authored content; genuinely long articles keep their normal scroll tail.
export default function TextViewport({ children, article, flow, showOverflow = false, automaticPadding, mode, resetKey = null }) {
  const viewport = useRef(null), content = useRef(null);
  // The first linked frame measures the same optional title field shown in Write.
  // This placeholder is only measuring UI; it never enters the saved article.
  const measuredArticle = mode === 'write' && !article.title ? { ...article, title: 'Title' } : article;
  const { remainder, visible, height, onMeasure } = useLinkedFrameLayout(article, flow);
  const { framed, overflow } = useTextFrame(viewport, article, flow ? 'read' : mode, { force: Boolean(flow), onMeasure });
  useLayoutEffect(() => { if (resetKey !== null) viewport.current.scrollTop = 0; }, [resetKey]);
  useLayoutEffect(() => {
    const scroll = viewport.current, body = content.current;
    if (framed || !automaticPadding) {
      scroll.style.removeProperty('--text-viewport-bottom-padding');
      return;
    }
    const measure = () => {
      const page = body.querySelector(mode === 'write' ? '.text-editor-page' : 'article.text-document');
      if (!page) return;
      const style = getComputedStyle(page), zoom = Number(style.zoom) || 1;
      const normal = parseFloat(style.getPropertyValue('--text-automatic-padding'));
      const withoutBottom = parseFloat(getComputedStyle(body).height) - parseFloat(style.paddingBottom) * zoom;
      const available = scroll.clientHeight - withoutBottom;
      const bottom = available >= 0 ? Math.min(normal, available / zoom) : normal;
      const value = `${Math.floor(bottom * 1000) / 1000}px`;
      if (scroll.style.getPropertyValue('--text-viewport-bottom-padding') !== value)
        scroll.style.setProperty('--text-viewport-bottom-padding', value);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(scroll); observer.observe(body);
    measure();
    return () => observer.disconnect();
  }, [automaticPadding, mode, framed]);
  return <div ref={viewport} className="text-module-scroll" data-text-frame={framed || undefined} data-text-flow-frame={flow ? 1 : undefined} style={flow ? { '--text-frame-height': height } : undefined} tabIndex={0} role="region" aria-label="Article content">
    {flow && <div className="text-flow-measure" aria-hidden="true" inert=""><ArticleView article={measuredArticle} flow={remainder} /></div>}
    <div ref={content} className={flow ? 'text-flow-visible' : 'text-module-content'}>{children}{flow && mode === 'read' && <ArticleView article={article} flow={visible} />}</div>
    {showOverflow && overflow && !flow && <TextFrameOverflow />}
  </div>;
}
