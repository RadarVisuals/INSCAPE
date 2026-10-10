import { useLayoutEffect, useRef, useState } from 'react';
import ArticleView from './ArticleView.jsx';

export default function PagedArticle({ article }) {
  const viewport = useRef(null), track = useRef(null);
  const [page, setPage] = useState(0), [count, setCount] = useState(1);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [direction, setDirection] = useState('next');
  const [turned, setTurned] = useState(false);
  const scale = article.appearance?.scale || 1;
  useLayoutEffect(() => {
    const node = viewport.current;
    const measure = () => setSize(old => old.width === node.clientWidth && old.height === node.clientHeight ? old : { width: node.clientWidth, height: node.clientHeight });
    const observer = new ResizeObserver(measure); observer.observe(node); measure();
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    let live = true;
    const measure = () => {
      if (!live) return;
      const document = track.current?.querySelector('article');
      if (!document) return;
      const style = getComputedStyle(document);
      // Columns use the content box; include authored side padding in the gap so
      // every page advances by the full viewport width and retains both margins.
      document.style.columnGap = `${32 / scale + parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)}px`;
      const pages = Math.max(1, Math.round((document.scrollWidth * scale + 32) / (size.width + 32)));
      setCount(pages); setPage(p => Math.min(p, pages - 1));
    };
    const observer = new ResizeObserver(measure);
    track.current.querySelectorAll('article, img').forEach(node => observer.observe(node));
    track.current.addEventListener('load', measure, true);
    document.fonts.ready.then(measure); document.fonts.addEventListener('loadingdone', measure);
    measure();
    const node = track.current;
    return () => { live = false; observer.disconnect(); node.removeEventListener('load', measure, true); document.fonts.removeEventListener('loadingdone', measure); };
  }, [article, size, scale, page]);
  const turn = next => { setTurned(true); setDirection(next > page ? 'next' : 'previous'); setPage(Math.max(0, Math.min(count - 1, next))); };
  return <div className="text-paged-reader" onPointerDown={e => e.stopPropagation()} onKeyDown={e => {
    if (e.target.closest('a, button')) return;
    if (['ArrowRight', 'PageDown', 'ArrowLeft', 'PageUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault(); e.stopPropagation(); turn(e.key === 'Home' ? 0 : e.key === 'End' ? count - 1 : page + (['ArrowRight', 'PageDown'].includes(e.key) ? 1 : -1));
    }
  }}>
    <div className="text-page-viewport" ref={viewport} tabIndex={0} role="region" aria-label="Article pages">
      <div key={page} className="text-page-turn" data-turn={turned || undefined} data-direction={direction}>
        <div ref={track} className="text-page-track" style={{ '--text-page-width': `${size.width / scale}px`, '--text-page-height': `${size.height / scale}px`, '--text-page-gap': `${32 / scale}px`, transform: `translateX(${-page * (size.width + 32)}px)` }}>
          <ArticleView article={article} />
        </div>
      </div>
    </div>
    {count > 1 && <nav className="text-page-navigation" aria-label="Text pages">
      <button type="button" aria-label="Previous text page" disabled={page === 0} onClick={() => turn(page - 1)}>‹</button>
      <span aria-live="polite">{page + 1} / {count}</span>
      <button type="button" aria-label="Next text page" disabled={page === count - 1} onClick={() => turn(page + 1)}>›</button>
    </nav>}
  </div>;
}
