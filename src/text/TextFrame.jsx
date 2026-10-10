import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { articleFlowSlice, articleNodeSize, fittingArticleEnd } from './articleFlow.js';

export function useArticleFlow(article, ids) {
  const total = articleNodeSize(article.content), key = ids.join('|');
  const source = useMemo(() => ({ article, key }), [article, key]);
  const current = useRef(source); current.current = source;
  const [layout, setLayout] = useState({ source, ends: [] });
  // Keep the previous measured boundaries during reflow so a focused editor
  // never becomes hidden between keystrokes. Every frame remeasures its current
  // source; these temporary positions never enter the article or saved layout.
  const ends = layout.ends;
  const report = useCallback((index, end) => {
    if (current.current !== source) return;
    setLayout(previous => {
      const values = previous.ends;
      if (previous.source === source && values[index] === end) return previous;
      const next = [...values]; next[index] = end;
      return { source, ends: next };
    });
  }, [source]);
  return { total, report, ranges: ids.map((id, index) => ({ id, from: index ? Math.min(total, ends[index - 1] ?? total) : 0, to: Math.min(total, ends[index] ?? total) })) };
}

export function useLinkedFrameLayout(article, flow, index = 0) {
  const range = flow?.ranges[index];
  const [height, setHeight] = useState('0px');
  const remainder = useMemo(() => flow && ({ ...articleFlowSlice(article.content, range.from ?? flow.total), title: index === 0 }), [article?.content, range?.from, flow?.total, Boolean(flow), index]);
  const visible = useMemo(() => flow && ({ ...articleFlowSlice(article.content, range.from ?? flow.total, range.to ?? flow.total), title: index === 0 }), [article?.content, range?.from, range?.to, flow?.total, Boolean(flow), index]);
  const onMeasure = flow ? (body, height) => {
    setHeight(previous => previous === height ? previous : height);
    if (range.from !== undefined) flow.report(index, fittingArticleEnd(body, range.from, flow.total));
  } : undefined;
  return { range, remainder, visible, height, onMeasure };
}
// The host supplies its available height; the article still owns typography,
// padding and content. Measurements are temporary and never enter the draft.
export function useTextFrame(viewport, article, mode, { force = false, onMeasure } = {}) {
  const measured = useRef(onMeasure); measured.current = onMeasure;
  const framed = force || (article?.appearance?.columns || 1) > 1;
  const scale = article?.appearance?.scale || 1;
  const [overflow, setOverflow] = useState(false);
  useLayoutEffect(() => {
    if (!framed || !viewport.current) { setOverflow(false); return; }
    const root = viewport.current;
    let live = true, request = 0, page = null, body = null, title = null;
    const selector = mode === 'write' ? '.text-editor-page' : 'article.text-document';
    const schedule = () => {
      if (!live || request) return;
      request = requestAnimationFrame(() => { request = 0; measure(); });
    };
    const resize = new ResizeObserver(schedule);
    const detach = () => {
      for (const node of [page, body, title]) if (node) resize.unobserve(node);
      page?.style.removeProperty('--text-frame-height');
    };
    const measure = () => {
      if (!live) return;
      const next = root.querySelector(selector);
      if (next !== page || next?.querySelector('.text-document-body') !== body || next?.querySelector('.text-document-title') !== title) {
        detach(); page = next; body = page?.querySelector('.text-document-body'); title = page?.querySelector('.text-document-title');
        for (const node of [page, body, title]) if (node) resize.observe(node);
      }
      if (!page || !body || !root.clientHeight || !page.getClientRects().length) { setOverflow(false); return; }
      const style = getComputedStyle(page);
      const padding = style.boxSizing === 'border-box' ? 0 : parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const height = Math.max(0, root.clientHeight / scale - padding);
      const value = `${Math.floor(height * 1000) / 1000}px`;
      if (page.style.getPropertyValue('--text-frame-height') !== value) page.style.setProperty('--text-frame-height', value);
      // CSS fragments whole lines into successive columns. Additional columns
      // remain in the same editor but are clipped at the authored frame edge.
      setOverflow(body.scrollWidth > body.clientWidth + 1 || body.scrollHeight > body.clientHeight + 1
        || page.scrollHeight > page.clientHeight + 1);
      measured.current?.(body, value);
    };
    const mutations = new MutationObserver(schedule);
    mutations.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'class', 'hidden'] });
    resize.observe(root);
    root.addEventListener('load', schedule, true);
    document.fonts.ready.then(schedule); document.fonts.addEventListener('loadingdone', schedule);
    measure();
    return () => {
      live = false; cancelAnimationFrame(request); mutations.disconnect(); resize.disconnect();
      root.removeEventListener('load', schedule, true); document.fonts.removeEventListener('loadingdone', schedule);
      page?.style.removeProperty('--text-frame-height');
    };
  }, [viewport, framed, scale, mode]);
  return { framed, overflow: framed && overflow };
}

export function TextFrameOverflow() {
  return <span className="text-frame-overflow" role="status" title="Enlarge the frame or use Focus writing to edit the full article.">Text doesn’t fit</span>;
}
