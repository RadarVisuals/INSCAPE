import { lazy, Suspense, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Grid2X2, Moon, RotateCw, Share2, Sun, X, ZoomIn, ZoomOut } from 'lucide-react';
import { resolvePublishedAssetUrl } from '../profileDocument/domain/publishedAssetUrl.js';
import { mobileTransform, mobileTransformCss } from './domain/mobilePresentation.js';
import './mobilePresentation.css';
const SteyraFront = lazy(() => import('./custom/SteyraFront.jsx'));
const SteyraExperiments = lazy(() => import('./custom/SteyraExperiments.jsx'));

function InlineText({ label, value, maxLength, onCommit }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <input className="mobile-inline-text" aria-label={label} value={draft} placeholder={label} maxLength={maxLength}
    onChange={event => setDraft(event.target.value)} onBlur={() => { if (draft !== value) onCommit(draft); }}
    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(value); event.stopPropagation(); } }} />;
}

function Image({ asset, className = '', style, decorative = false, eager = false }) {
  const url = resolvePublishedAssetUrl(asset?.media?.url);
  const [state, setState] = useState('loading');
  const [attempt, retry] = useState(0);
  useEffect(() => setState('loading'), [url, attempt]);
  if (!url) return asset ? <span className="mobile-media-error" role="status">Artwork unavailable</span> : null;
  return <>{state !== 'error' && <img key={`${url}:${attempt}`} className={className} style={style} src={url}
    alt={decorative ? '' : asset.name || 'Artwork'} draggable={false} loading={eager ? 'eager' : 'lazy'} decoding="async"
    onLoad={() => setState('ready')} onError={() => setState('error')} />}
    {state === 'error' && <span className="mobile-media-error" role="status">Image unavailable <button onClick={event => { event.stopPropagation(); retry(n => n + 1); }}>Retry</button></span>}</>;
}

function FrontArtwork({ front }) {
  const sourceMaskUrl = resolvePublishedAssetUrl(front.mask?.media?.url);
  const [maskUrl, setMaskUrl] = useState(null);
  const maskTransform = mobileTransform(front, 'mask');
  const transformKey = JSON.stringify(maskTransform);
  const id = useId().replace(/:/g, '');
  const [maskReady, setMaskReady] = useState(false);
  const [maskFailed, setMaskFailed] = useState(false);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    setMaskReady(false); setMaskFailed(false);
    if (!sourceMaskUrl) { setMaskFailed(Boolean(front.mask)); return undefined; }
    let live = true;
    const image = new window.Image(); image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (!live) return;
      try {
        if (!maskTransform.quarterTurns && !maskTransform.mirrorX && !maskTransform.mirrorY) setMaskUrl(sourceMaskUrl);
        else {
          const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1920;
          const ctx = canvas.getContext('2d'); ctx.translate(540, 960); ctx.rotate(maskTransform.quarterTurns * Math.PI / 2);
          ctx.scale(maskTransform.mirrorX ? -1 : 1, maskTransform.mirrorY ? -1 : 1);
          ctx.drawImage(image, -540, -960, 1080, 1920); setMaskUrl(canvas.toDataURL('image/png'));
        }
        setMaskReady(true);
      } catch { setMaskFailed(true); }
    };
    image.onerror = () => { if (live) setMaskFailed(true); };
    image.src = sourceMaskUrl;
    return () => { live = false; image.onload = null; image.onerror = null; };
  }, [sourceMaskUrl, attempt, Boolean(front.mask), transformKey]);
  const masked = Boolean(front.mask);
  return <>
    {(!masked || maskReady) && <div className="mobile-art-mask" style={maskUrl ? {
      maskImage: `url("${maskUrl}")`, WebkitMaskImage: `url("${maskUrl}")`, maskMode: 'alpha' } : undefined}>
      <Image asset={front.artwork} eager className="mobile-front-art" style={{
        objectFit: front.image.fit, left: `${front.image.x * 100}%`, top: `${front.image.y * 100}%`,
        transform: `translate(-50%,-50%) scale(${front.image.scale}) ${mobileTransformCss(mobileTransform(front, 'artwork'))}` }} />
    </div>}
    {masked && !maskReady && <div className="mobile-mask-status" role="status">{maskFailed ? <>Mask unavailable. <button onClick={() => retry(n => n + 1)}>Retry</button></> : 'Loading mask…'}</div>}
    {maskReady && front.border.width > 0 && <svg className="mobile-mask-border" viewBox="0 0 1080 1920" aria-hidden="true">
      <defs><filter id={id} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
        <feMorphology in="SourceAlpha" operator="dilate" radius={front.border.width} result="expanded" />
        <feComposite in="expanded" in2="SourceAlpha" operator="out" result="edge" />
        <feFlood floodColor={front.border.color} /><feComposite in2="edge" operator="in" />
      </filter></defs><image href={maskUrl} width="1080" height="1920" preserveAspectRatio="none" filter={`url(#${id})`} />
    </svg>}
  </>;
}

/** Rendering only: no draft store, wallet, Library, or network identity ownership. */
export default function MobilePresentation({ content, identity, active = true, onExit, editPositions, editor, navigationRequest, onViewChange, rememberTheme = false }) {
  const [view, setView] = useState('card'), [turns, setTurns] = useState(0), [turning, setTurning] = useState(false);
  const [theme, setTheme] = useState(content.theme), [selected, setSelected] = useState(null);
  const [info, setInfo] = useState(false), [zoom, setZoom] = useState(1), [pan, setPan] = useState({ x: 0, y: 0 });
  const [notice, setNotice] = useState('');
  const root = useRef(null), indexScroll = useRef(null), scroll = useRef(0), turnTimer = useRef(null), lock = useRef(false);
  const points = useRef(new Map()), gesture = useRef(null), returnFocus = useRef(null);
  const focusFrame = useRef(null), live = useRef(true), cardSurface = useRef(null);
  const back = turns % 2 === 1;
  useEffect(() => { gesture.current = null; points.current.clear(); }, [editor?.revision]);
  const entries = content.index.entries;
  const current = Math.max(0, entries.findIndex(entry => entry.id === selected));
  const work = entries[current]?.asset;
  const title = identity?.officialProfile?.name || identity?.name || identity?.profile?.displayName || 'Profile';
  const profileTitle = identity?.authoredProfile?.title || title;
  useEffect(() => { onViewChange?.(view === 'card' ? back ? 'back' : 'front' : view); }, [view, back, onViewChange]);
  useEffect(() => {
    if (!navigationRequest) return;
    const target = navigationRequest.target;
    if (target === 'front' || target === 'back') { go('card'); if ((target === 'back') !== back) flip(undefined, true); }
    else go(target);
  }, [navigationRequest]);
  // The authored front colour does not change with the visitor's UI theme.
  // Keep functional text readable on that surface in either theme.
  const frontChannels = content.front.color.slice(1).match(/../g).map(hex => {
    const channel = parseInt(hex, 16) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
  });
  const lightFront = content.front.renderer === 'steyra' ? theme === 'light'
    : frontChannels[0] * .2126 + frontChannels[1] * .7152 + frontChannels[2] * .0722 > .179;
  useEffect(() => setTheme(content.theme), [content.theme]);
  useEffect(() => {
    if (!rememberTheme) return;
    try { const saved = localStorage.getItem('inscape-mobile-theme'); if (saved === 'light' || saved === 'dark') setTheme(saved); } catch { /* Storage is optional for visitor preferences. */ }
  }, [rememberTheme]);
  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'; setTheme(next);
    if (rememberTheme) try { localStorage.setItem('inscape-mobile-theme', next); } catch { /* Keep the session preference. */ }
  }
  useEffect(() => {
    live.current = true;
    return () => { live.current = false; clearTimeout(turnTimer.current); cancelAnimationFrame(focusFrame.current); };
  }, []);
  useLayoutEffect(() => {
    const elements = [...root.current.querySelectorAll('.mobile-positioned')];
    const observer = new ResizeObserver(records => {
      for (const { target } of records) {
        target.style.setProperty('--mobile-bound-x', `${target.offsetWidth / 2 + 8}px`);
        target.style.setProperty('--mobile-bound-y', `${target.offsetHeight / 2 + 8}px`);
      }
    });
    elements.forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, []);
  useEffect(() => { if (!active) { points.current.clear(); gesture.current = null; } }, [active]);
  useLayoutEffect(() => { if (view === 'index' && indexScroll.current) indexScroll.current.scrollTop = scroll.current; }, [view]);
  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); setInfo(false); }, [selected, view]);
  useEffect(() => { if (view === 'work' && !work) setView('index'); }, [view, work]);
  function focusAfterRender(target) {
    cancelAnimationFrame(focusFrame.current);
    focusFrame.current = requestAnimationFrame(() => {
      const node = typeof target === 'string' ? root.current?.querySelector(target) : target;
      if (live.current && node?.isConnected) node.focus({ preventScroll: true });
    });
  }
  function closeInfo() { setInfo(false); focusAfterRender(returnFocus.current); }
  function go(next) {
    if (view === 'index') scroll.current = indexScroll.current?.scrollTop || 0;
    setView(next); points.current.clear(); gesture.current = null;
    focusAfterRender(next === 'index' ? '.mobile-index h2' : next === 'work' ? '.mobile-work-title' : '.mobile-back h2');
  }
  function flip(event, force = false) {
    if (lock.current || editPositions && !force) return;
    const keyboard = event?.detail === 0 || event?.type === 'keydown';
    lock.current = true; setTurning(true); setTurns(n => n + 1);
    turnTimer.current = setTimeout(() => {
      lock.current = false; setTurning(false);
      if (keyboard) focusAfterRender(back ? '[aria-label="Turn card to profile"]' : '.mobile-back h2');
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 720);
  }
  function moveWork(delta) {
    const next = entries[current + delta];
    if (next) setSelected(next.id);
  }
  useEffect(() => {
    if (!active) return undefined;
    const key = event => {
      if (!root.current?.contains(event.target) && event.target !== document.body) return;
      if (event.key === 'Escape') {
        if (info) closeInfo();
        else if (zoom > 1) { setZoom(1); setPan({ x: 0, y: 0 }); }
        else if (view === 'work') go('index');
        else if (view === 'index') go('card');
        else if (back) flip(event);
      }
      if (view === 'work' && !info && zoom === 1 && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault(); moveWork(event.key === 'ArrowLeft' ? -1 : 1);
      }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [active, info, zoom, view, back, current, entries]);
  useEffect(() => {
    if (!info) return;
    root.current?.querySelector('.mobile-info button')?.focus();
  }, [info]);
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title, url: location.href });
      else { await navigator.clipboard.writeText(location.href); if (live.current) setNotice('Link copied'); }
    } catch (error) { if (live.current && error.name !== 'AbortError') setNotice('Could not share this link.'); }
  }
  const position = key => ({ left: `clamp(var(--mobile-bound-x, 0px), ${content.front.positions[key].x * 100}%, calc(100% - var(--mobile-bound-x, 0px)))`,
    top: `clamp(var(--mobile-bound-y, 0px), ${content.front.positions[key].y * 100}%, calc(100% - var(--mobile-bound-y, 0px)))` });
  function positionDown(event, key) {
    if (!editPositions) return;
    editor?.onSelect(key);
    if (editor?.locked.has(key)) return;
    event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { key, id: event.pointerId, initial: content.front.positions[key], bounds: event.currentTarget.parentElement.getBoundingClientRect() };
  }
  function positionMove(event) {
    const g = gesture.current;
    if (!editPositions || !g?.key || g.id !== event.pointerId) return;
    const snap = (value, size) => event.altKey ? value : Math.round(value * size / 12) * 12 / size;
    g.position = { x: Math.max(.06, Math.min(.94, snap((event.clientX - g.bounds.left) / g.bounds.width, 1080))),
      y: Math.max(.05, Math.min(.95, snap((event.clientY - g.bounds.top) / g.bounds.height, 1920))) };
    editPositions(g.key, g.position, false);
  }
  const movable = key => ({ style: position(key), 'data-edit-selected': editor?.selection === key || undefined,
    hidden: editor?.hidden.has(key), tabIndex: editor ? 0 : undefined,
    onFocus: () => editor?.onSelect(key),
    onKeyDown: event => {
      if (!editPositions || !event.key.startsWith('Arrow') || editor?.locked.has(key)) return;
      event.preventDefault(); event.stopPropagation(); const old = content.front.positions[key], step = event.altKey ? 1 : 12;
      editPositions(key, { x: Math.max(.06, Math.min(.94, old.x + (event.key === 'ArrowRight' ? step / 1080 : event.key === 'ArrowLeft' ? -step / 1080 : 0))),
        y: Math.max(.05, Math.min(.95, old.y + (event.key === 'ArrowDown' ? step / 1920 : event.key === 'ArrowUp' ? -step / 1920 : 0))) }, true);
    }, onPointerDown: e => positionDown(e, key), onPointerMove: positionMove,
    onPointerUp: () => { const g = gesture.current; if (g?.position) editPositions?.(key, g.position, true); gesture.current = null; },
    onPointerCancel: () => { const g = gesture.current; if (g?.position) editPositions?.(key, g.initial, true); gesture.current = null; } });
  function cardDown(event) {
    if (editPositions || event.target.closest('button,a,input') || event.button !== 0) return;
    points.current.set(event.pointerId, true);
    if (points.current.size === 1) gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    else gesture.current = null;
  }
  function cardUp(event) {
    points.current.delete(event.pointerId);
    const g = gesture.current; gesture.current = null;
    if (g?.id === event.pointerId && Math.hypot(event.clientX - g.x, event.clientY - g.y) < 9) flip();
  }
  function workDown(event) {
    if (event.button !== 0 || event.target.closest('button')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const p = [...points.current.values()];
    gesture.current = { x: event.clientX, y: event.clientY, pan, zoom, multi: p.length > 1,
      distance: p.length === 2 ? Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) : 0 };
  }
  function workMove(event) {
    if (!points.current.has(event.pointerId) || !gesture.current) return;
    points.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const p = [...points.current.values()], g = gesture.current;
    if (p.length === 2 && g.distance > 0) setZoom(Math.max(1, Math.min(4, g.zoom * Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) / g.distance)));
    else if (zoom > 1 && !g.multi) {
      const bounds = event.currentTarget.getBoundingClientRect();
      setPan({ x: Math.max(-bounds.width, Math.min(bounds.width, g.pan.x + event.clientX - g.x)),
        y: Math.max(-bounds.height, Math.min(bounds.height, g.pan.y + event.clientY - g.y)) });
    }
  }
  function workUp(event) {
    const g = gesture.current; points.current.delete(event.pointerId);
    if (points.current.size || !g) return;
    gesture.current = null;
    if (!g.multi && zoom === 1 && Math.abs(event.clientX - g.x) > 60 && Math.abs(event.clientY - g.y) < 100) moveWork(event.clientX > g.x ? -1 : 1);
  }
  const brand = <><span className="mobile-wordmark" aria-label="INSCAPE" /><span className="mobile-brand-id">.ID</span></>;
  const caption = asset => asset.name !== asset.collectionName ? asset.name : '';
  return <section ref={root} className={`mobile-presentation mobile-theme-${theme}`} aria-label="Mobile presentation" hidden={!active}>
    <div ref={cardSurface} className={`mobile-card ${turning ? 'mobile-turning' : ''}`} hidden={view !== 'card'} onPointerDown={cardDown} onPointerUp={cardUp} onPointerCancel={() => { gesture.current = null; points.current.clear(); }}>
      <div className="mobile-flipper" style={{ transform: `rotateY(${turns * 180}deg)` }}>
        <div className="mobile-face mobile-front" aria-hidden={back} inert={back || turning ? '' : undefined} style={{ backgroundColor: content.front.color,
          color: lightFront ? '#252723' : '#efeeeb', '--mobile-front-accent': lightFront ? '#914600' : '#ff9500' }}>
          {!editor?.hidden.has('background') && <Image asset={content.front.background} className="mobile-background" decorative eager style={{ transform: mobileTransformCss(mobileTransform(content.front, 'background')) }} />}
          <div className={`mobile-design-canvas ${content.front.renderer !== 'steyra' ? 'mobile-design-bottom' : ''}`}>
            {content.front.renderer === 'steyra'
              ? <Suspense fallback={<p className="mobile-mask-status">Loading Steyra…</p>}><SteyraFront active={active && view === 'card'} light={theme === 'light'} interactionSurface={cardSurface} /></Suspense>
              : !editor?.hidden.has('artwork') && <FrontArtwork front={editor?.hidden.has('mask') ? { ...content.front, mask: null } : content.front} />}
            {editor && <div className="mobile-art-edit-target" data-edit-selected={editor.selection === 'artwork'} tabIndex={0} role="button" aria-label="Move artwork" onFocus={() => editor.onSelect('artwork')}
              onKeyDown={event => {
                if (!event.key.startsWith('Arrow') || editor.locked.has('artwork')) return;
                event.preventDefault(); event.stopPropagation(); const step = event.altKey ? 1 : 12, value = content.front.image;
                editor.onImage({ ...value, x: Math.max(-1, Math.min(2, value.x + (event.key === 'ArrowRight' ? step / 1080 : event.key === 'ArrowLeft' ? -step / 1080 : 0))),
                  y: Math.max(-1, Math.min(2, value.y + (event.key === 'ArrowDown' ? step / 1920 : event.key === 'ArrowUp' ? -step / 1920 : 0))) }, true);
              }}
              onPointerDown={event => {
                if (event.button !== 0) return; editor.onSelect('artwork'); if (editor.locked.has('artwork')) return;
                event.currentTarget.setPointerCapture(event.pointerId); const bounds = event.currentTarget.getBoundingClientRect();
                gesture.current = { artwork: true, id: event.pointerId, x: event.clientX, y: event.clientY, bounds, initial: content.front.image };
              }} onPointerMove={event => {
                const g = gesture.current; if (!g?.artwork || g.id !== event.pointerId) return;
                const snap = (value, size) => event.altKey ? value : Math.round(value * size / 12) * 12 / size;
                g.value = { ...g.initial, x: Math.max(-1, Math.min(2, snap(g.initial.x + (event.clientX - g.x) / g.bounds.width, 1080))),
                  y: Math.max(-1, Math.min(2, snap(g.initial.y + (event.clientY - g.y) / g.bounds.height, 1920))) };
                editor.onImage(g.value, false);
              }} onPointerUp={() => { const g = gesture.current; if (g?.value) editor.onImage(g.value, true); gesture.current = null; }}
              onPointerCancel={() => { const g = gesture.current; if (g?.artwork) editor.onImage(g.initial, false); gesture.current = null; }} />}
            {editor?.selection === 'artwork' && !editor.locked.has('artwork') && <button className="mobile-art-resize" aria-label="Scale artwork" title="Drag to scale artwork"
              onPointerDown={event => { if (event.button !== 0) return; event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
                gesture.current = { resize: true, id: event.pointerId, x: event.clientX, y: event.clientY, bounds: event.currentTarget.parentElement.getBoundingClientRect(), initial: content.front.image }; }}
              onPointerMove={event => { const g = gesture.current; if (!g?.resize || g.id !== event.pointerId) return;
                const delta = (event.clientX - g.x) / g.bounds.width + (event.clientY - g.y) / g.bounds.height;
                g.value = { ...g.initial, scale: Math.max(.1, Math.min(4, Math.round((g.initial.scale + delta) * 100) / 100)) }; editor.onImage(g.value, false); }}
              onPointerUp={() => { const g = gesture.current; if (g?.value) editor.onImage(g.value, true); gesture.current = null; }}
              onPointerCancel={() => { const g = gesture.current; if (g?.resize) editor.onImage(g.initial, false); gesture.current = null; }}
              onKeyDown={event => { if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); event.stopPropagation();
                editor.onImage({ ...content.front.image, scale: Math.max(.1, Math.min(4, content.front.image.scale + (['ArrowUp', 'ArrowRight'].includes(event.key) ? .01 : -.01))) }, true); }}>↘</button>}
            <div className="mobile-front-brand mobile-positioned" {...movable('brand')}>{brand}</div>
            <div className="mobile-front-name mobile-positioned" {...movable('name')}>{title}</div>
            <button className="mobile-positioned" {...movable('theme')} aria-label="Toggle colour theme" onClick={() => !editPositions && toggleTheme()}>{theme === 'dark' ? <Sun /> : <Moon />}</button>
            <button className="mobile-positioned" {...movable('flip')} aria-label="Turn card to profile" onClick={flip}><RotateCw /></button>
            <button className="mobile-positioned" {...movable('share')} aria-label="Share profile" onClick={() => !editPositions && share()}><Share2 /></button>
          </div>
        </div>
        <div className="mobile-face mobile-back" aria-hidden={!back} inert={!back || turning ? '' : undefined}>
          <header>{brand}</header><div className="mobile-profile-scroll">
            {profileTitle !== title && <p className="mobile-profile-title">{profileTitle}</p>}
            <h2 tabIndex={-1}>{title}</h2>
            {identity?.profile?.description && <p className="mobile-bio">{identity.profile.description}</p>}
            {identity?.profile?.tags?.length > 0 && <div className="mobile-tags">{identity.profile.tags.map(tag => <span key={typeof tag === 'string' ? tag : tag.label}>{typeof tag === 'string' ? tag : tag.label}</span>)}</div>}
            <div className="mobile-profile-links">{identity?.links?.map(link => <a key={link.id || link.url} href={link.url} target="_blank" rel="noreferrer" aria-label={link.label} title={link.label}>
              {link.id === 'universal-everything' ? 'UP↗' : /^https:\/\/(www\.)?(x\.com|twitter\.com)\//i.test(link.url) ? '𝕏' : link.label}</a>)}</div>
            {identity?.status?.metadata && !['RESOLVED', 'READY'].includes(identity.status.metadata) && <p className="mobile-secondary">Some profile information may be unavailable.</p>}
            <button className="mobile-index-link" onClick={() => go('index')}><Grid2X2 />Works <small>{entries.length}</small><ArrowRight /></button>
            {entries.length > 0 && <div className="mobile-work-thumbs">{entries.slice(0, 5).map(entry => <button key={entry.id} aria-label={`Open ${entry.asset.name || 'artwork'}`} onClick={() => { setSelected(entry.id); go('work'); }}><Image asset={entry.asset} /></button>)}</div>}
            {content.front.renderer === 'steyra' && <button onClick={() => go('experiment')}>The world inside · Experiments <ArrowRight /></button>}
          </div><footer>{onExit && <button onClick={onExit} aria-label="Leave mobile presentation"><ArrowLeft /></button>}<button onClick={toggleTheme} aria-label="Toggle colour theme"><Sun /></button><button onClick={flip}>Turn card <RotateCw /></button></footer>
        </div>
      </div>
    </div>
    {view === 'index' && <div className="mobile-index">
      <header><button aria-label="Back to profile" onClick={() => go('card')}><ArrowLeft /></button>{brand}</header>
      <div className="mobile-index-scroll" ref={indexScroll}><h2 tabIndex={-1}>{editor ? <InlineText label="Heading" value={content.index.title} maxLength={80} onCommit={value => editor.onIndexText('title', value)} /> : content.index.title || 'Index'} <sup>{entries.length}</sup></h2>
        {editor ? <InlineText label="Introduction" value={content.index.intro} maxLength={240} onCommit={value => editor.onIndexText('intro', value)} /> : content.index.intro && <p className="mobile-index-intro">{content.index.intro}</p>}
        {entries.length ? <div className="mobile-index-columns">{[0, 1].map(column => <div key={column}>{entries.map((entry, i) => i % 2 === column && <button key={entry.id} className="mobile-index-item" data-edit-selected={editor?.selection === entry.id || undefined}
          draggable={Boolean(editor)} onDragStart={event => { event.dataTransfer.setData('application/x-inscape-mobile-entry', entry.id); event.dataTransfer.effectAllowed = 'move'; }}
          onDragOver={event => { if (editor && event.dataTransfer.types.includes('application/x-inscape-mobile-entry')) { event.preventDefault(); event.currentTarget.dataset.dropBefore = 'true'; } }}
          onDragLeave={event => { delete event.currentTarget.dataset.dropBefore; }}
          onDrop={event => { delete event.currentTarget.dataset.dropBefore; const id = event.dataTransfer.getData('application/x-inscape-mobile-entry'); if (editor && id) { event.preventDefault(); editor.onReorder(id, entry.id); } }}
          aria-label={`Open ${entry.asset.name || 'artwork'}`} onClick={() => { if (editor) { editor.onSelect(entry.id); return; } setSelected(entry.id); go('work'); }}>
          <Image asset={entry.asset} /><span><small>{String(i + 1).padStart(2, '0')}</small>{caption(entry.asset)}</span>
        </button>)}</div>)}</div> : <p>No works have been selected for this Index.</p>}
        <p className="mobile-index-credit">Curated by {title}</p>
        {editor?.renderIndexDrop()}
      </div>
    </div>}
    {view === 'work' && work && <div className="mobile-work">
      <div className="mobile-work-stage" inert={info ? '' : undefined} onPointerDown={workDown} onPointerMove={workMove} onPointerUp={workUp} onPointerCancel={() => { points.current.clear(); gesture.current = null; }}>
        <div className="mobile-work-image" style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}><Image asset={work} eager /></div>
      </div><footer inert={info ? '' : undefined}><button onClick={() => go('index')} aria-label="Open artwork index"><Grid2X2 /></button>
        <button className="mobile-work-title" onClick={event => { returnFocus.current = event.currentTarget; setInfo(true); }}><strong>{work.name}</strong><small>{current + 1} / {entries.length} · Info</small></button>
        <button aria-label="Previous work" disabled={current === 0 || zoom > 1} onClick={() => moveWork(-1)}><ChevronLeft /></button>
        <button aria-label="Next work" disabled={current === entries.length - 1 || zoom > 1} onClick={() => moveWork(1)}><ChevronRight /></button>
        <button aria-label={zoom > 1 ? 'Reset zoom' : 'Zoom artwork'} onClick={() => { setZoom(zoom > 1 ? 1 : 2); setPan({ x: 0, y: 0 }); }}>{zoom > 1 ? <ZoomOut /> : <ZoomIn />}</button>
      </footer>
      {info && <div className="mobile-info" role="dialog" aria-modal="true" aria-label="Artwork information" onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const buttons = event.currentTarget.querySelectorAll('button,a'); const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}><button aria-label="Close artwork information" onClick={closeInfo}><X /></button>
        <p className="mobile-secondary">ABOUT THIS WORK / {String(current + 1).padStart(2, '0')}</p><h2>{work.name}</h2>
        {work.collectionName && <p className="mobile-secondary">{work.collectionName}</p>}{work.description && <p>{work.description}</p>}
        {work.creators?.length > 0 && <><h3>Creator attribution</h3>{work.creators.map(creator => <p key={creator.address}>{creator.name || creator.address}</p>)}</>}
        {work.attributes?.length > 0 && <dl>{work.attributes.map((attr, i) => <div key={i}><dt>{attr.key}</dt><dd>{attr.value}</dd></div>)}</dl>}
      </div>}
    </div>}
    {view === 'experiment' && <Suspense fallback={<p role="status">Opening experiment…</p>}><SteyraExperiments onClose={() => go('card')} /></Suspense>}
    {notice && <button className="mobile-notice" onClick={() => setNotice('')}>{notice}</button>}
    {onExit && view === 'card' && !back && !turning && <button className="mobile-exit" onClick={onExit} aria-label="Leave mobile presentation"><ArrowLeft size={16} /></button>}
  </section>;
}
