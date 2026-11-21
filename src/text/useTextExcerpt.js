import { useLayoutEffect, useState } from 'react';

// Shared by native Bento Text and its public reading projection. Measurement
// clips complete lines/columns without changing the authored box or article.
export default function useTextExcerpt(host, content, { article, enabled = true, id, singleLine = false, clipBounds, onOverflow }) {
  const horizontal = singleLine || article.appearance?.writingDirection === 'stacked';
  const { left = 0, top = 0, right = Infinity, bottom = Infinity } = clipBounds || {};
  const [clip, setClip] = useState({ overflow: false, size: null, fade: 0, start: 0 });
  useLayoutEffect(() => {
    if (!enabled) return;
    let active = true, pending, frameSize;
    const measure = () => {
      pending = null;
      if (!active || !frameSize) return;
      const box = host.current, page = content.current;
      const bounds = box.getBoundingClientRect();
      // Native Editor camera zoom scales DOM rectangles; CSS clipping uses local
      // layout pixels. Public Reception usually has scale 1, but uses this same path.
      // clientWidth/Height round fractional layout pixels. That can turn a
      // fitting first line into a partial line in responsive or zoomed frames.
      const scaleX = bounds.width / frameSize.width || 1, scaleY = bounds.height / frameSize.height || 1;
      // The authored text frame stays intact. Only its visible intersection
      // with the cell participates in overflow/fade measurement.
      const visibleLeft = Math.max(0, left), visibleTop = Math.max(0, top);
      const visibleRight = Math.max(0, Math.min(frameSize.width, right)), visibleBottom = Math.max(0, Math.min(frameSize.height, bottom));
      const available = horizontal ? visibleRight : visibleBottom;
      const beginning = horizontal ? visibleLeft : visibleTop;
      // Measure visible ink, not the article's trailing paragraph margins. A
      // short chapter strip must not overflow solely because of empty spacing.
      const rects = [], walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
      const textScale = Number(getComputedStyle(page.querySelector('article') || page).zoom) || 1;
      while (walker.nextNode()) {
        if (!walker.currentNode.textContent.trim()) continue;
        const range = document.createRange(); range.selectNodeContents(walker.currentNode);
        const style = getComputedStyle(walker.currentNode.parentElement);
        const leading = (parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2) * textScale;
        rects.push(...[...range.getClientRects()].map(rect => ({ rect, leading })));
      }
      for (const node of page.querySelectorAll('figure, hr')) rects.push({ rect: node.getBoundingClientRect(), leading: 0 });
      const local = rects.map(({ rect: r, leading }) => ({ width: r.width, height: r.height, leading,
        left: (r.left - bounds.left) / scaleX, right: (r.right - bounds.left) / scaleX,
        top: (r.top - bounds.top) / scaleY, bottom: (r.bottom - bounds.top) / scaleY }));
      const spans = local.filter(r => r.width && r.height).map(r => ({
        start: horizontal ? r.left : r.top,
        end: horizontal ? r.right : r.bottom,
        leading: r.leading,
      })).sort((a, b) => a.start - b.start);
      const lines = [];
      for (const span of spans) {
        const line = lines.at(-1);
        // Inline marks share a line, but font boxes can also overlap the next
        // line when leading is compact. Compare centres, not mere overlap.
        if (line && Math.abs((span.start + span.end - line.start - line.end) / 2) < Math.min(span.end - span.start, line.end - line.start) / 2) {
          line.start = Math.min(line.start, span.start); line.end = Math.max(line.end, span.end);
          line.leading = Math.max(line.leading, span.leading);
        } else lines.push({ ...span });
      }
      const overflow = local.some(r => r.width && r.height && (r.left < visibleLeft - 1 || r.top < visibleTop - 1
        || r.right > visibleRight + 1 || r.bottom > visibleBottom + 1));
      const trailing = lines.some(line => line.end > available + 1);
      const visible = lines.filter(line => line.start >= beginning - 1 && line.end <= available + 1);
      const last = visible.sort((a, b) => b.end - a.end)[0];
      const size = trailing && !singleLine ? Math.max(0, Math.min(available, Math.ceil(last?.end || 0))) : available;
      const first = visible.sort((a, b) => a.start - b.start)[0];
      const fade = !trailing ? 0 : singleLine ? Math.min(24, available / 4)
        : !last ? 0 : horizontal ? Math.min(16, last.end - last.start)
        : Math.min((last.leading || last.end - last.start) * 1.75, Math.max(0, size - first.start) / 2);
      const partialStart = beginning > 0 && lines.some(line => line.start < beginning - 1 && line.end > beginning + 1);
      const start = partialStart && !singleLine ? Math.max(beginning, Math.floor(first?.start ?? available)) : beginning;
      setClip(previous => previous.overflow === overflow && previous.size === size && previous.fade === fade && previous.start === start
        ? previous : { overflow, size, fade, start });
      onOverflow?.(id, { overflow });
    };
    const schedule = () => { if (active && pending == null) pending = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) if (entry.target === host.current) frameSize = entry.contentRect;
      schedule();
    });
    observer.observe(host.current); observer.observe(content.current);
    document.fonts.ready.then(schedule); document.fonts.addEventListener('loadingdone', schedule);
    return () => { active = false; cancelAnimationFrame(pending); observer.disconnect(); document.fonts.removeEventListener('loadingdone', schedule); };
  }, [enabled, article, horizontal, singleLine, id, onOverflow, left, top, right, bottom, host, content]);
  const style = !enabled || clip.size === null ? undefined : {
    clipPath: horizontal ? `inset(0 max(0px, calc(100% - ${clip.size}px)) 0 ${clip.start}px)`
      : `inset(${clip.start}px 0 max(0px, calc(100% - ${clip.size}px)) 0)`,
    maskImage: clip.overflow && clip.fade ? `linear-gradient(to ${horizontal ? 'right' : 'bottom'}, #000 ${Math.max(0, clip.size - clip.fade)}px, transparent ${clip.size}px)` : undefined,
  };
  return { ...clip, horizontal, overflow: enabled && clip.overflow, style };
}
