import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, ArrowRight, Image as ImageIcon, LayoutDashboard, FileText } from 'lucide-react';
import { useProfileIdentity } from '../../profileIdentity/state/useProfileIdentity.js';
import { createPublishedIdentityRackViewModel } from './publishedIdentityRackViewModel.js';
import { useStartupDestinationReady } from '../../startveil/StartupDestinationContext.jsx';
import { applicationRouteUrl } from '../../profileDiscovery/applicationNavigation.js';
import { resolvePublishedAssetUrl } from '../domain/publishedAssetUrl.js';
import { publicCanvasItems, publicOverviewHeading } from './profileOverviewModel.js';
import '../../public/ownerSystemWorkflow/workflowTactile.css';
import './profileOverview.css';

const ProfileWorkViewer = lazy(() => import('./ProfileWorkViewer.jsx'));
const GridProductionRenderer = lazy(() => import('./GridProductionRenderer.jsx'));
const plainClick = event => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

function PreviewImage({ src, alt = '' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed ? <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    : <span className="profile-overview__placeholder"><ImageIcon aria-hidden="true" /><span>Preview unavailable</span></span>;
}

function TilePreview({ item, document, featured }) {
  const node = useRef(null);
  const [visible, setVisible] = useState(featured);
  useEffect(() => {
    if (visible || item.kind !== 'composition') return;
    if (typeof IntersectionObserver !== 'function') { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '120px' });
    observer.observe(node.current);
    return () => observer.disconnect();
  }, [visible, item.kind]);
  return <div className={`profile-overview__preview profile-overview__preview--${item.kind}`} ref={node} inert="" aria-hidden="true">
    {item.kind === 'composition' ? visible && <Suspense fallback={<span className="profile-overview__placeholder">Loading composition…</span>}>
      <GridProductionRenderer document={{ ...document, ...item.display }} grid={item.grid} imageLoading={featured ? 'eager' : 'lazy'} />
    </Suspense> : item.kind === 'image' ? <PreviewImage src={resolvePublishedAssetUrl(item.asset?.media?.url)} />
      : <><FileText size={22} /><p>{item.description || 'Open this article.'}</p></>}
  </div>;
}

export default function ProfileOverview({ document, onOpenCanvas, onOpenDirectory, onReturn, unavailableTarget = false, returnTarget, focusedTarget, onOpenWork, onCloseWork, reception }) {
  useStartupDestinationReady();
  const root = useRef(null), tileNodes = useRef(new Map());
  const identity = useProfileIdentity(document.profile.address);
  const model = useMemo(() => createPublishedIdentityRackViewModel({ document, identity }), [document, identity]);
  const items = useMemo(() => publicCanvasItems(document).slice(0, 4), [document]);
  const name = model?.profile.displayName || document.profile.cachedIdentity.name || 'Unnamed profile';
  const canvasHref = target => applicationRouteUrl(window.location, { kind: 'profile', address: document.profile.address, canvas: true, reception, ...(target ? { target } : {}) });
  const workHref = target => applicationRouteUrl(window.location, { kind: 'profile', address: document.profile.address, reception, target });
  const [localTarget, setLocalTarget] = useState(null);
  const viewerTarget = focusedTarget || localTarget;
  const openWork = (event, target) => { if (plainClick(event)) { event.preventDefault(); if (onOpenWork) onOpenWork(target); else setLocalTarget(target); } };
  const closeWork = () => { if (onCloseWork) onCloseWork(); else setLocalTarget(null); };
  const open = (event, target) => { if (plainClick(event) && onOpenCanvas) { event.preventDefault(); onOpenCanvas(target); } };
  useEffect(() => {
    const key = returnTarget?.moduleId ? returnTarget.moduleId + (returnTarget.gridId ? '/' + returnTarget.gridId : '') : 'explore';
    const node = returnTarget ? tileNodes.current.get(key) : null;
    (node || root.current)?.focus({ preventScroll: true });
    node?.scrollIntoView({ block: 'nearest' });
  }, []);
  return <main className="profile-overview" data-workflow-material="tactile" data-published-focus-fallback tabIndex={-1} ref={root} aria-label={`${name} overview`}>
    <div className="profile-overview__inner">
      <header className="profile-overview__header"><span className="profile-overview__wordmark">INSCAPE</span>
        <nav aria-label="Profile navigation">{onOpenDirectory && <button className="workflow-tactile-control" onClick={event => onOpenDirectory(event.currentTarget)}>Discover</button>}
          {onReturn && <button className="workflow-tactile-control" onClick={onReturn}>My canvas</button>}</nav>
      </header>
      <div className="profile-overview__heading"><span>A world by</span><h1>{publicOverviewHeading(document.profile.address, name)}</h1></div>
      {unavailableTarget && <p className="profile-overview__notice" role="status">That destination is no longer in this publication. Explore the available work below.</p>}
      <section className="profile-overview__grid" data-item-count={items.length} style={{ "--overview-explore-span": Math.max(1, 5 - items.length) }} aria-label="Profile and published work">
        <article className="profile-overview__identity profile-overview__tile">
          {model?.profile.avatarUrl && <div className="profile-overview__avatar"><PreviewImage src={resolvePublishedAssetUrl(model.profile.avatarUrl)} /></div>}
          <div><span className="profile-overview__eyebrow">About</span><h2>{name}</h2>
            {model?.profile.description && <p>{model.profile.description}</p>}
            {model?.profile.tags.length > 0 && <ul className="profile-overview__tags">{model.profile.tags.slice(0, 4).map(tag => <li key={tag}>{tag}</li>)}</ul>}
          </div>
          {model?.links.length > 0 && <nav className="profile-overview__links" aria-label="Profile links">{model.links.slice(0, 3).map(link =>
            <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer">{link.label}<ArrowUpRight size={14} aria-hidden="true" /></a>)}</nav>}
          <span className="profile-overview__address" title={document.profile.address}>{document.profile.address.slice(0, 8)}…{document.profile.address.slice(-6)}</span>
        </article>
        {items.map((item, index) => <a key={item.key} className={`profile-overview__tile profile-overview__work${index === 0 ? ' profile-overview__work--featured' : ''}`}
          ref={node => { if (node) tileNodes.current.set(item.key, node); else tileNodes.current.delete(item.key); }} href={workHref(item.target)} onClick={event => openWork(event, item.target)} aria-label={`Open ${item.title}`}>
          <TilePreview item={item} document={document} featured={index === 0} />
          <div className="profile-overview__caption"><div><span className="profile-overview__eyebrow">{item.kind === 'composition' ? 'Composition' : item.kind === 'text' ? 'Writing' : 'Artwork'}</span><h2>{item.title}</h2></div><ArrowUpRight size={20} aria-hidden="true" /></div>
        </a>)}
        <a className="profile-overview__tile profile-overview__explore" ref={node => { if (node) tileNodes.current.set("explore", node); else tileNodes.current.delete("explore"); }} href={canvasHref()} onClick={event => open(event)}>
          <LayoutDashboard size={24} aria-hidden="true" /><div><h2>Explore canvas</h2><p>Step inside the full world.</p></div><ArrowRight size={24} aria-hidden="true" />
        </a>
      </section>
      <footer className="profile-overview__footer"><span>{name}</span><span>Made in INSCAPE</span></footer>
    </div>
    {viewerTarget && <Suspense fallback={<div className="profile-overview__notice" role="status">Opening work…</div>}>
      <ProfileWorkViewer key={`${document.documentId}:${document.revision}`} document={document} target={viewerTarget} name={publicOverviewHeading(document.profile.address, name)} publisherName={name}
        onClose={closeWork} onOpenCanvas={onOpenCanvas} canvasHref={canvasHref} />
    </Suspense>}
  </main>;
}
