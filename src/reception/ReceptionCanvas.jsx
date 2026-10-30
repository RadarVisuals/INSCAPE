import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { UserRound } from 'lucide-react';
import ImageArtwork from '../imageModule/ImageArtwork.jsx';
import ArticleView from '../text/ArticleView.jsx';
import IdentityPortrait from '../public/identity/IdentityPortrait.jsx';
import { receptionPixelRect } from './receptionLayout.js';
import '../imageModule/imageModule.css';
import './reception.css';
const ReceptionLinkedContent = lazy(() => import('./ReceptionLinkedContent.jsx'));

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

export function ReceptionImage({ record, onRecoverFocus, decorative = false }) {
  const node = useRef(null), size = useBounds(node), [recoveryHost, setRecoveryHost] = useState(null);
  const side = record?.sides[0];
  return <div className="reception-image" ref={node}>
    <div className="reception-artwork" role={decorative ? undefined : 'img'} aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : record?.name || side?.asset?.name || 'Artwork'} aria-description={decorative ? undefined : side?.asset?.description || undefined}>
      {side && size.width > 0 && <ImageArtwork side={side} rectangle={{ left: 0, top: 0, ...size }} recoveryHost={recoveryHost} onRecoverFocus={onRecoverFocus} />}
    </div>
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
export default function ReceptionCanvas({ reception, model, address, selected, onSelect, mode, renderText, renderEmpty, renderMoveHandle, splitHint, dragging, cropTarget, onCropStart, onCropKey, renderFrameTools, onSize, onOpenSource }) {
  const frame = useRef(null), size = useBounds(frame);
  const mobile = mode === 'mobile' || mode !== 'desktop' && size.width <= 640;
  const order = mobile ? reception.mobile.map(m => reception.regions.find(r => r.id === m.id)) : reception.regions;
  const width = size.width, height = size.height;
  useEffect(() => { onSize?.(size); }, [size, onSize]);
  const content = region => {
    const link = reception.links?.find(item => item.id === region.content);
    if (link) return <Suspense fallback={<p role="status">Opening linked content…</p>}><ReceptionLinkedContent link={link} onOpen={onOpenSource} /></Suspense>;
    const image = reception.imageModules.find(item => item.id === region.content);
    if (image) return <ReceptionImage record={image} onRecoverFocus={() => {
      const cell = [...(frame.current?.querySelectorAll('[data-region-id]') || [])].find(node => node.dataset.regionId === region.id);
      cell?.focus({ preventScroll: true });
    }} />;
    const text = reception.texts.find(item => item.id === region.content);
    if (text) return renderText?.(text, region) || <ArticleView article={text.article} containerOwned />;
    if (region.content) return <ProfileContent kind={region.content} model={model} address={address} />;
    return onSelect && renderEmpty ? renderEmpty(region) : null;
  };
  return <section className="reception-canvas" aria-label="Reception layout" data-mobile={mobile || undefined} ref={frame}
    style={{ '--reception-gutter': `${reception.gutter}px`, '--reception-radius': `${reception.radius}px`, background: reception.surface || undefined }}>
    <div className="reception-paint">
      {order.map((region, index) => {
        const mobileItem = reception.mobile.find(m => m.id === region.id), image = reception.imageModules.some(i => i.id === region.content);
        const text = reception.texts.some(item => item.id === region.content);
        const rect = receptionPixelRect(region, width, height, reception.gutter), padding = image ? 0 : region.padding ?? (text ? 24 : reception.padding);
        return <section key={region.id} className="reception-region" data-region-id={region.id} data-selected={selected === region.id || undefined}
          data-dragging={dragging === region.id || undefined} data-image={image || undefined} data-text={text || undefined} data-linked={region.content?.startsWith('link:') || undefined} data-empty={!region.content || undefined}
          aria-label={`Region ${index + 1}${region.content ? ` · ${region.content.split(':')[0]}` : ' · Empty'}`}
          tabIndex={onSelect ? 0 : -1} onPointerDown={onSelect ? () => onSelect(region.id) : undefined}
          onKeyDown={onSelect ? event => { if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); onSelect(region.id); } } : undefined}
          style={{ ...(mobile ? { gridColumn: `span ${mobileItem.columns}`, minHeight: mobileItem.height } : { position: 'absolute', ...rect }),
            background: region.surface || reception.surface || undefined, padding,
            '--reception-align-x': { left: 'flex-start', center: 'center', right: 'flex-end' }[region.alignX],
            '--reception-align-y': { top: 'flex-start', center: 'center', bottom: 'flex-end' }[region.alignY] }}>
          <div className="reception-region-content">{content(region)}
            {cropTarget === region.id && <div className="reception-crop-target" role="group" aria-label="Reframe image" tabIndex={0}
              onPointerDown={event => { event.stopPropagation(); onCropStart(event, event.currentTarget.parentElement); }}
              onKeyDown={event => onCropKey(event, event.currentTarget.parentElement)} />}
          </div>
          {onSelect && selected === region.id && splitHint && <div className="reception-split-hint" data-axis={splitHint} aria-hidden="true" />}
          {onSelect && selected === region.id && renderMoveHandle && <div className="reception-cell-handle workbench-tool-controls" data-window-chrome="flat" onPointerDown={event => event.stopPropagation()}>{renderMoveHandle()}</div>}
        </section>;
      })}
    </div>
    {renderFrameTools?.({ frame, width, height, mobile })}
  </section>;
}
