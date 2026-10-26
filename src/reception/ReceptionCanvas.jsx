import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { UserRound } from 'lucide-react';
import ImageArtwork from '../imageModule/ImageArtwork.jsx';
import ArticleView from '../text/ArticleView.jsx';
import IdentityPortrait from '../public/identity/IdentityPortrait.jsx';
import { receptionDividers, receptionMinimum, receptionPixelRect } from './receptionLayout.js';
import { RECEPTION_EXTENT } from '../profileDocument/domain/receptionPresentation.js';
import '../imageModule/imageModule.css';
import './reception.css';

function useBounds(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => { const { width, height } = node.getBoundingClientRect(); setSize(previous => previous.width === width && previous.height === height ? previous : { width, height }); };
    measure(); const observer = new ResizeObserver(measure); observer.observe(node); return () => observer.disconnect();
  }, [ref]);
  return size;
}

// A real silhouette with a concave navigation join. It clips the artwork and
// surface together; there are no page-colored patches over transparent media.
export function receptionContour(width, height, radius, notchWidth, notchHeight) {
  const w = Math.max(1, width), h = Math.max(1, height), n = Math.min(Math.max(0, notchWidth), Math.max(0, w - 40));
  const t = Math.min(Math.max(0, notchHeight), Math.max(0, h - 40)), r = Math.min(radius, (w - n) / 2, n / 2, t / 2, h / 2);
  return `M 0 ${t + r} Q 0 ${t} ${r} ${t} H ${n - r} Q ${n} ${t} ${n} ${t - r} V ${r} Q ${n} 0 ${n + r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} Z`;
}

export function ReceptionImage({ record, onRecoverFocus }) {
  const node = useRef(null), size = useBounds(node), [recoveryHost, setRecoveryHost] = useState(null);
  const side = record?.sides[0];
  return <div className="reception-image" ref={node}>
    {side && size.width > 0 && <ImageArtwork side={side} rectangle={{ left: 0, top: 0, ...size }} recoveryHost={recoveryHost} onRecoverFocus={onRecoverFocus} />}
    <div ref={setRecoveryHost} className="reception-media-status" />
  </div>;
}
function ProfileContent({ kind, model, address }) {
  const profile = model?.profile || {}, official = model?.officialProfile || {}, name = profile.displayName || official.name || 'Unnamed profile';
  if (kind === 'links') return <nav className="reception-profile-links" aria-label="Profile links">{(model?.links || []).map((link, index) =>
    <a key={link.id || index} href={link.url} target="_blank" rel="noreferrer">{link.title || link.label || 'Website'} ↗</a>)}</nav>;
  if (kind === 'details') return <dl className="reception-profile-details">{(model?.card?.fields || []).map(field => <div key={field.id}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>;
  if (kind === 'introduction') return <div className="reception-profile-copy"><h2>About {name}</h2><p>{profile.description}</p>
    {!!profile.tags?.length && <ul>{profile.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>}</div>;
  return <div className="reception-profile-copy"><div className="reception-profile-portrait">{profile.avatarUrl
    ? <IdentityPortrait src={profile.avatarUrl} title={`${name} portrait`} /> : <UserRound aria-hidden="true" />}</div><h1>{name}</h1>
    <p>{profile.description}</p><a href={official.url || `https://universaleverything.io/${address}`} target="_blank" rel="noreferrer">Official Universal Profile · {official.name || address} ↗</a></div>;
}
export default function ReceptionCanvas({ reception, model, address, navigation, selected, onSelect, mode, renderText, onDividerStart, onDividerKey, onMoveStart, moveTarget, onWidth }) {
  const frame = useRef(null), nav = useRef(null), size = useBounds(frame), navSize = useBounds(nav), clipId = useId().replaceAll(':', '');
  const mobile = mode === 'mobile' || mode !== 'desktop' && size.width <= 640;
  const order = mobile ? reception.mobile.map(m => reception.regions.find(r => r.id === m.id)) : reception.regions;
  const width = size.width, height = mobile ? size.height : reception.height;
  useEffect(() => { onWidth?.(width); }, [width, onWidth]);
  const path = receptionContour(width, height, reception.radius, navSize.width + reception.gutter, navSize.height + reception.gutter);
  const content = region => {
    const image = reception.imageModules.find(item => item.id === region.content);
    if (image) return <ReceptionImage record={image} onRecoverFocus={() => {
      const cell = [...(frame.current?.querySelectorAll('[data-region-id]') || [])].find(node => node.dataset.regionId === region.id);
      cell?.focus({ preventScroll: true });
    }} />;
    const text = reception.texts.find(item => item.id === region.content);
    if (text) return renderText?.(text, region) || <ArticleView article={text.article} containerOwned />;
    if (region.content) return <ProfileContent kind={region.content} model={model} address={address} />;
    return onSelect ? <span className="reception-empty">Select region · Add content</span> : null;
  };
  return <section className="reception-canvas" aria-label="Reception layout" data-mobile={mobile || undefined} ref={frame}
    style={{ '--reception-gutter': `${reception.gutter}px`, '--reception-radius': `${reception.radius}px`, ...(mobile ? {} : { height }) }}>
    <svg width="0" height="0" aria-hidden="true" className="reception-clip"><defs><clipPath id={clipId} clipPathUnits="userSpaceOnUse"><path d={path} /></clipPath></defs></svg>
    <div className="reception-navigation" ref={nav}>{navigation}</div>
    <div className="reception-paint" style={{ clipPath: `url(#${clipId})` }}>
      {order.map((region, index) => {
        const mobileItem = reception.mobile.find(m => m.id === region.id), image = reception.imageModules.some(i => i.id === region.content);
        const rect = receptionPixelRect(region, width, height, reception.gutter), padding = region.padding ?? reception.padding;
        const firstMobileRow = index === 0 || index === 1 && reception.mobile[0].columns === 1 && mobileItem.columns === 1;
        const mobileLeft = index === 1 ? (width + reception.gutter) / 2 : 0;
        const underNav = mobile ? firstMobileRow && mobileLeft < navSize.width + reception.gutter
          : region.y === 0 && rect.left < navSize.width + reception.gutter;
        return <section key={region.id} className="reception-region" data-region-id={region.id} data-selected={selected === region.id || undefined}
          data-drop-target={moveTarget === region.id || undefined} data-image={image || undefined}
          aria-label={`Region ${index + 1}${region.content ? ` · ${region.content.split(':')[0]}` : ' · Empty'}`}
          tabIndex={onSelect ? 0 : -1} onPointerDown={onSelect ? () => onSelect(region.id) : undefined}
          onKeyDown={onSelect ? event => { if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); onSelect(region.id); } } : undefined}
          style={{ ...(mobile ? { gridColumn: `span ${mobileItem.columns}`, minHeight: mobileItem.height } : { position: 'absolute', ...rect }),
            borderTopLeftRadius: underNav ? 0 : undefined,
            borderTopRightRadius: underNav && !mobile && rect.left + rect.width <= navSize.width + reception.gutter ? 0 : undefined,
            background: region.surface || undefined, padding, paddingTop: underNav && !image ? Math.max(padding, navSize.height + reception.gutter + padding) : padding,
            '--reception-align-x': { left: 'flex-start', center: 'center', right: 'flex-end' }[region.alignX],
            '--reception-align-y': { top: 'flex-start', center: 'center', bottom: 'flex-end' }[region.alignY] }}>
          <div className="reception-region-content">{content(region)}</div>
        </section>;
      })}
    </div>
    {onSelect && <div className="reception-selection-layer" aria-hidden="true">{!mobile && reception.regions.filter(r => r.id === selected).map(r =>
      <div className="reception-selection" key={r.id} style={{ ...receptionPixelRect(r, width, height, reception.gutter), borderRadius: reception.radius }} />)}</div>}
    {onMoveStart && selected && <button className="workflow-tactile-control reception-move-grip" type="button" aria-label="Drag selected content"
      onPointerDown={event => onMoveStart(event, frame.current)} disabled={!reception.regions.find(r => r.id === selected)?.content}>Move / swap</button>}
    {moveTarget && <output className="reception-drop-label" aria-live="polite">{reception.regions.find(r => r.id === moveTarget)?.content ? 'Drop to swap content' : 'Drop to move content'}</output>}
    {onDividerStart && !mobile && receptionDividers(reception, receptionMinimum(width, height, reception.gutter)).map((d, index) => <button key={d.id} className="reception-divider" type="button" disabled={d.min > d.max}
      aria-label={`Resize divider ${index + 1}`} role="slider" aria-orientation={d.axis === 'x' ? 'horizontal' : 'vertical'} aria-valuemin={d.min / 100} aria-valuemax={d.max / 100} aria-valuenow={d.position / 100}
      data-axis={d.axis} onPointerDown={event => onDividerStart(event, d, frame.current)} onKeyDown={event => onDividerKey(event, d)}
      style={d.axis === 'x' ? { left: d.position / RECEPTION_EXTENT * (width + reception.gutter) - reception.gutter / 2, top: d.from / RECEPTION_EXTENT * (height + reception.gutter), height: (d.to - d.from) / RECEPTION_EXTENT * (height + reception.gutter) - reception.gutter }
        : { top: d.position / RECEPTION_EXTENT * (height + reception.gutter) - reception.gutter / 2, left: d.from / RECEPTION_EXTENT * (width + reception.gutter), width: (d.to - d.from) / RECEPTION_EXTENT * (width + reception.gutter) - reception.gutter }} />)}
  </section>;
}
