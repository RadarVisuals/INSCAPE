import { useLayoutEffect, useRef } from 'react';

// Automatic end spacing may yield to a fitting article. Explicit article padding
// remains authored content; genuinely long articles keep their normal scroll tail.
export default function TextViewport({ children, automaticPadding, mode }) {
  const viewport = useRef(null), content = useRef(null);
  useLayoutEffect(() => {
    const scroll = viewport.current, body = content.current;
    if (!automaticPadding) {
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
  }, [automaticPadding, mode]);
  return <div ref={viewport} className="text-module-scroll" tabIndex={0} role="region" aria-label="Article content">
    <div ref={content} className="text-module-content">{children}</div>
  </div>;
}
