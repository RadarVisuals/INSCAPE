import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Info, List, X, ExternalLink } from 'lucide-react';
import GridProductionRenderer from './GridProductionRenderer.jsx';
import { publicReadingPages } from './profileOverviewModel.js';
import { textSurfaceStyle } from '../../text/domain/article.js';
import './profileWorkViewer.css';

const ArticleView = lazy(() => import('../../text/ArticleView.jsx'));
const ImageArtwork = lazy(() => import('../../imageModule/ImageArtwork.jsx'));
const labelFor = kind => kind === 'composition' ? 'Composition' : kind === 'text' ? 'Writing' : 'Artwork';

// Only nearby pages mount media. Geometry remains in place, so the native scroll
// position and index destinations never depend on an image finishing its load.
function ReadingPage({ page, publication, scroller, register, onArtwork }) {
  const node = useRef(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!scroller.current) return;
    const observer = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), {
      root: scroller.current, rootMargin: '100% 0px',
    });
    observer.observe(node.current);
    return () => observer.disconnect();
  }, [scroller]);
  const style = page.kind === 'composition' ? { aspectRatio: `${page.display.geometry.columns} / ${page.display.geometry.rows}` }
    : page.kind === 'image' ? { aspectRatio: `${page.record.width} / ${page.record.height}` } : textSurfaceStyle(page.article);
  return <section ref={element => { node.current = element; register(page.key, element); }}
    className="profile-work-viewer__page" data-reading-page={page.key} aria-label={page.title}>
    <header className="profile-work-viewer__page-heading"><span>{labelFor(page.kind)}</span><h2>{page.title}</h2></header>
    <div className={`profile-work-viewer__content profile-work-viewer__content--${page.kind}`} style={style}>
      {page.kind === 'composition' ? near && <GridProductionRenderer document={{ ...publication, ...page.display }} grid={page.grid}
        imageLoading="eager" onPlacementActivate={({ placement }) => onArtwork(placement.asset)} />
        : page.kind === 'image' ? near && <Suspense fallback={<p role="status">Loading artwork…</p>}><ImageArtwork side={page.side}
          rectangle={{ left: 0, top: 0, width: page.record.width, height: page.record.height }} /></Suspense>
          : <Suspense fallback={<p role="status">Loading article…</p>}><ArticleView article={page.article} /></Suspense>}
    </div>
    {page.description && page.kind !== 'text' && <p className="profile-work-viewer__description">{page.description}</p>}
  </section>;
}

export default function ProfileWorkViewer({ document: publication, target, name, publisherName, onClose, onOpenCanvas, canvasHref }) {
  const dialog = useRef(null), scroller = useRef(null), nodes = useRef(new Map());
  const indexButton = useRef(null), infoButton = useRef(null), closeButton = useRef(null);
  const pages = useMemo(() => publicReadingPages(publication), [publication]);
  const [active, setActive] = useState(0), [panel, setPanel] = useState(null), [artwork, setArtwork] = useState(null);
  const page = pages[active] || pages[0];
  const closing = useRef(false);
  const close = () => { if (!closing.current) { closing.current = true; onClose(); } };
  const returnFocus = useRef(null);
  const closePanel = () => { const trigger = panel === 'index' ? indexButton : infoButton; setPanel(null); setArtwork(null); trigger.current?.focus(); };
  useLayoutEffect(() => {
    const node = dialog.current;
    const origin = globalThis.document.activeElement;
    if (!returnFocus.current) returnFocus.current = origin?.closest('.profile-overview') && !node.contains(origin)
      ? origin : node.closest('.profile-overview');
    node.showModal();
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      node.close();
      const origin = returnFocus.current;
      // Wait for React to remove the modal before focusing its formerly inert
      // background, including direct links with no native opener to restore.
      requestAnimationFrame(() => { if (origin?.isConnected) origin.focus({ preventScroll: true }); });
    };
  }, []);
  useLayoutEffect(() => {
    const index = Math.max(0, pages.findIndex(item => item.target.moduleId === target.moduleId
      && (!target.gridId || item.target.gridId === target.gridId)));
    const node = nodes.current.get(pages[index]?.key), viewport = scroller.current;
    if (node && viewport) viewport.scrollTop = node.offsetTop;
    setActive(index); setPanel(null); setArtwork(null);
  }, [pages, target.moduleId, target.gridId]);
  useEffect(() => {
    const viewport = scroller.current;
    let frame;
    const readPosition = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const position = viewport.scrollTop + Math.min(180, viewport.clientHeight * .3);
        let selected = 0;
        pages.forEach((item, index) => { if ((nodes.current.get(item.key)?.offsetTop ?? Infinity) <= position) selected = index; });
        setActive(selected);
      });
    };
    viewport.addEventListener('scroll', readPosition, { passive: true });
    return () => { viewport.removeEventListener('scroll', readPosition); cancelAnimationFrame(frame); };
  }, [pages]);
  const navigate = index => {
    const node = nodes.current.get(pages[index]?.key);
    if (!node) return;
    scroller.current.scrollTo({ top: node.offsetTop,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    setActive(index); setPanel(null); setArtwork(null); scroller.current.focus({ preventScroll: true });
  };
  const showArtwork = asset => { setArtwork(asset); setPanel('info'); infoButton.current?.focus(); };
  const toggle = next => { setArtwork(null); setPanel(current => current === next ? null : next); };
  const onCancel = event => { event.preventDefault(); if (panel) closePanel(); else close(); };
  const assets = page?.kind === 'composition' ? page.grid.placements.filter(p => p.asset).map(p => p.asset)
    : page?.kind === 'image' ? [page.side.asset] : [];
  return <dialog ref={dialog} className="profile-work-viewer" data-workflow-material="tactile" aria-label={`${name} — published work`}
    onCancel={onCancel} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="profile-work-viewer__layout">
      <div className="profile-work-viewer__frame">
        <div className="profile-work-viewer__scroll" ref={scroller} tabIndex={0} role="region" aria-label="Published work"
          inert={panel === 'info' ? '' : undefined}>
          <div className="profile-work-viewer__paper">
            {pages.map(item => <ReadingPage key={item.key} page={item} publication={publication} scroller={scroller}
              register={(key, node) => { if (node) nodes.current.set(key, node); else nodes.current.delete(key); }} onArtwork={showArtwork} />)}
            <footer className="profile-work-viewer__end"><span>{name}</span><button type="button" onClick={close}>Return to profile <ArrowRight size={16} /></button></footer>
          </div>
        </div>
        {panel === 'info' && <section className="profile-work-viewer__information" aria-label="Information">
          <header><span>Information</span><button type="button" className="workflow-tactile-control profile-work-viewer__key" aria-label="Close information" onClick={closePanel}><X /></button></header>
          <div className="profile-work-viewer__information-body">
            <span className="profile-work-viewer__eyebrow">{artwork ? 'Source artwork' : labelFor(page.kind)}</span>
            <h2>{artwork?.name || page.title}</h2>
            {(artwork ? artwork.description : page.description) && <p>{artwork ? artwork.description : page.description}</p>}
            {!artwork && <><dl><div><dt>Published by</dt><dd>{publisherName}</dd></div><div><dt>Profile</dt><dd>{publication.profile.address}</dd></div></dl>
              {assets.length > 0 && <div className="profile-work-viewer__sources"><h3>In this composition</h3>{assets.map((asset, index) =>
                <button key={`${asset.stableAssetId}:${index}`} type="button" className="workflow-tactile-control workflow-tactile-control--quiet" onClick={() => setArtwork(asset)}>{asset.name || 'Untitled artwork'}<ArrowRight size={16} /></button>)}</div>}</>}
            {artwork && <><dl>{artwork.collectionName && <div><dt>Collection</dt><dd>{artwork.collectionName}</dd></div>}
              {artwork.contractAddress && <div><dt>Contract</dt><dd>{artwork.contractAddress}</dd></div>}
              {artwork.tokenId && <div><dt>Token</dt><dd>{artwork.tokenId}</dd></div>}
              {(artwork.creators || []).map((creator, index) => <div key={index}><dt>Creator · {creator.source} / {creator.scope}</dt><dd>{creator.name || creator.address}</dd></div>)}</dl>
              <button type="button" className="profile-work-viewer__text-button" onClick={() => setArtwork(null)}>← Composition information</button></>}
          </div>
        </section>}
      </div>
      <div className="profile-work-viewer__navigation">
        <span className="profile-work-viewer__name">{name}</span>
        <div className="profile-work-viewer__toolbar" role="toolbar" aria-label="Work navigation">
          <button type="button" className="workflow-tactile-control profile-work-viewer__key" aria-label="Previous work" title="Previous work" disabled={active === 0} onClick={() => navigate(active - 1)}><ArrowLeft /></button>
          <button type="button" className="workflow-tactile-control profile-work-viewer__key" aria-label="Work index" title="Index" ref={indexButton} aria-expanded={panel === 'index'} aria-controls="profile-work-index" onClick={() => toggle('index')}><List /></button>
          <span className="profile-work-viewer__counter" aria-live="polite">{String(active + 1).padStart(2, '0')} <span>/ {String(pages.length).padStart(2, '0')}</span></span>
          <button type="button" className="workflow-tactile-control profile-work-viewer__key" aria-label="Next work" title="Next work" disabled={active === pages.length - 1} onClick={() => navigate(active + 1)}><ArrowRight /></button>
          <span className="profile-work-viewer__separator" />
          <button type="button" className="workflow-tactile-control profile-work-viewer__key" aria-label="Work information" title="Information" ref={infoButton} aria-expanded={panel === 'info'} onClick={() => toggle('info')}><Info /></button>
          <a className="workflow-tactile-control profile-work-viewer__key" aria-label="Open current work on canvas" title="Open on canvas" href={canvasHref(page.target)} onClick={event => {
            if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && onOpenCanvas) { event.preventDefault(); onOpenCanvas(page.target); }
          }}><ExternalLink /></a>
          <span className="profile-work-viewer__separator" />
          <button type="button" className="workflow-tactile-control profile-work-viewer__key" aria-label="Close work viewer" title="Close · Escape" ref={closeButton} onClick={close}><X /></button>
        </div>
        <span className="profile-work-viewer__current">{page.title}</span>
        {panel === 'index' && <section id="profile-work-index" className="profile-work-viewer__index" aria-label="Work index">
          <header><strong>Index</strong><button type="button" className="workflow-tactile-control profile-work-viewer__key" aria-label="Close index" onClick={closePanel}><X /></button></header>
          <nav aria-label="Published destinations">{pages.map((item, index) => <button type="button" key={item.key}
            className="workflow-tactile-control workflow-tactile-control--quiet" aria-current={index === active ? 'location' : undefined}
            onClick={() => navigate(index)}><span>{String(index + 1).padStart(2, '0')}</span><span>{item.title}<small>{labelFor(item.kind)}</small></span><ArrowRight size={16} /></button>)}</nav>
        </section>}
      </div>
    </div>
  </dialog>;
}
