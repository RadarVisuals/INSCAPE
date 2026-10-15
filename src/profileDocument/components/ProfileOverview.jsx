import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { useProfileIdentity } from '../../profileIdentity/state/useProfileIdentity.js';
import { createPublishedIdentityRackViewModel } from './publishedIdentityRackViewModel.js';
import { useStartupDestinationReady } from '../../startveil/StartupDestinationContext.jsx';
import { applicationRouteUrl } from '../../profileDiscovery/applicationNavigation.js';
import { publicCanvasItems } from './profileOverviewModel.js';
import { SceneNavigationProvider } from '../../text/SceneNavigation.jsx';
import { SharedDisplayToolsProvider, SharedDisplayToolWindows, useSharedDisplayTools } from '../../public/ownerSystemWorkflow/SharedDisplayTools.jsx';
import useOwnerSystemWorkflowLayout from '../../public/ownerSystemWorkflow/useOwnerSystemWorkflowLayout.js';
import BentoStage from './BentoStage.jsx';
import BentoDisplayFrame from './BentoDisplayFrame.jsx';
import IdentityCardBody from '../../public/identity/IdentityCardBody.jsx';
import IdentityTitle from '../../public/identity/IdentityTitle.jsx';
import IdentityClouds from '../../public/identity/IdentityClouds.jsx';
import { resolveIdentityCard } from '../../profileIdentity/domain/identityCard.js';
import { LATTICE_SURFACES } from '../../lattice/rendering/latticeGeometry.js';
import useReceptionCarousel from './useReceptionCarousel.js';
import ReceptionImagePreview from './ReceptionImagePreview.jsx';
import { projectSystemWorkflowTransform } from '../../systemWorkflow/systemWorkflowTransform.js';
import ProfileWorkViewer from './ProfileWorkViewer.jsx';
import { ArtworkPreparationProvider } from '../../artwork/ArtworkPreparation.jsx';
import '../../public/ownerSystemWorkflow/workflowTactile.css';
import '../../public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../../public/ownerSystemWorkflow/workbenchWindowChrome.css';
import '../../public/identity/identityModule.css';
import '../../lattice/rendering/latticeMenuSurface.css';
import './profileOverview.css';

const PublishedDisplayModule = lazy(() => import('./PublishedDisplayModule.jsx'));
const BentoLinkedText = lazy(() => import('./BentoLinkedText.jsx'));
const plainClick = event => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

function TilePreview({ item, side, onReady }) {
  return <div className={'profile-overview__preview profile-overview__preview--' + item.kind} inert="" aria-hidden="true">
    {side ? <ReceptionImagePreview side={side} onReady={onReady} />
      : <><FileText size={22} /><p>{item.description || 'Open this article.'}</p></>}
  </div>;
}

export default function ProfileOverview(props) {
  return <SharedDisplayToolsProvider key={[props.document.profile.address, props.document.documentId, props.document.revision].join(':')}>
    <SceneNavigationProvider><ProfileOverviewContent {...props} /></SceneNavigationProvider>
  </SharedDisplayToolsProvider>;
}

function ProfileOverviewContent({ document, onOpenCanvas, unavailableTarget = false, returnTarget, focusedTarget, onOpenWork, onCloseWork, reception, onEditImage }) {
  useStartupDestinationReady();
  const root = useRef(null), rail = useRef(null), tileNodes = useRef(new Map());
  const [linkedModule, setLinkedModule] = useState(() => (focusedTarget || returnTarget)?.moduleId);
  useLayoutEffect(() => {
    const id = (focusedTarget || returnTarget)?.moduleId;
    if (id) setLinkedModule(id);
  }, [focusedTarget?.moduleId, returnTarget?.moduleId]);
  const identity = useProfileIdentity(document.profile.address);
  const model = useMemo(() => createPublishedIdentityRackViewModel({ document, identity }) || {
    address: document.profile.address, profile: { displayName: document.profile.cachedIdentity.name || 'Unnamed profile',
      avatarUrl: document.profile.cachedIdentity.avatarUrl, tags: [], description: '' }, links: [],
  }, [document, identity]);
  const items = useMemo(() => {
    const published = publicCanvasItems(document);
    if (document.reception) {
      const selected = document.reception.items.map(id => published.find(item => item.key === id)).filter(Boolean);
      // Curation chooses the landing composition; explicit links still resolve
      // every public module and keep their return origin mounted.
      const destination = published.find(item => item.key === ((focusedTarget || returnTarget)?.moduleId || linkedModule));
      return destination && !selected.includes(destination) ? [...selected, destination] : selected;
    }
    return [...published.filter(item => item.kind === 'image'), ...published.filter(item => item.kind !== 'image')];
  }, [document, focusedTarget?.moduleId, returnTarget?.moduleId, linkedModule]);
  const [expanded, setExpanded] = useState('compact');
  useLayoutEffect(() => {
    const fields = root.current?.querySelector('.identity-module__extension');
    if (!fields) return;
    const measure = () => root.current?.style.setProperty('--reception-fields-height', `${fields.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(fields); measure();
    return () => observer.disconnect();
  }, []);
  const card = model.card || resolveIdentityCard({});
  const hasArtwork = model.profile.avatarProvenance === 'INSCAPE_PUBLISHED_ASSET';
  const official = model.officialProfile || { name: model.profile.displayName, avatarUrl: model.profile.avatarUrl,
    url: `https://universaleverything.io/${document.profile.address}` };
  const layout = useOwnerSystemWorkflowLayout();
  const tools = useSharedDisplayTools();
  const name = model?.profile.displayName || document.profile.cachedIdentity.name || 'Unnamed profile';
  const canvasHref = target => applicationRouteUrl(window.location, { kind: 'profile', address: document.profile.address, canvas: true, reception, ...(target ? { target } : {}) });
  const workHref = target => applicationRouteUrl(window.location, { kind: 'profile', address: document.profile.address, reception, target });
  const [localTarget, setLocalTarget] = useState(null);
  // The card and its inspection share one temporary side selection and one
  // mounted artwork. No publication fields or module sessions are rewritten.
  const [sides, setSides] = useState({}), [readySources, setReadySources] = useState({});
  const requestedTarget = focusedTarget || localTarget;
  const viewerTarget = items.some(item => item.target.moduleId === requestedTarget?.moduleId && item.kind !== 'display' && !item.record?.sceneLink) ? requestedTarget : null;
  const viewerItem = items.find(item => item.key === viewerTarget?.moduleId);
  useReceptionCarousel(rail, { disabled: Boolean(viewerTarget) || expanded === 'profile', reducedMotion: layout.reducedMotion, revision: expanded });
  useLayoutEffect(() => {
    if (focusedTarget || returnTarget) {
      const node = tileNodes.current.get((focusedTarget || returnTarget).moduleId);
      if (node && rail.current) {
        const bounds = node.getBoundingClientRect(), viewport = rail.current.getBoundingClientRect();
        if (bounds.left < viewport.left || bounds.right > viewport.right) rail.current.scrollLeft += bounds.left - viewport.left;
      }
    }
  }, [focusedTarget?.moduleId, returnTarget?.moduleId]);
  const openWork = (event, target) => { if (plainClick(event)) { event.preventDefault(); if (onOpenWork) onOpenWork(target); else setLocalTarget(target); } };
  const closingWork = useRef(false);
  useEffect(() => { closingWork.current = false; }, [viewerTarget]);
  const closeWork = () => {
    if (closingWork.current) return;
    closingWork.current = true;
    if (onCloseWork) onCloseWork(); else setLocalTarget(null);
  };
  const open = (event, target) => { if (plainClick(event) && onOpenCanvas) { event.preventDefault(); onOpenCanvas(target); } };
  useEffect(() => {
    if (!focusedTarget && returnTarget) tileNodes.current.get(returnTarget.moduleId)?.focus({ preventScroll: true });
  }, [returnTarget?.moduleId]);
  const wideImage = item => {
    if (item.kind !== 'image') return false;
    const side = item.record.sides[0];
    if (!side) return false;
    const size = projectSystemWorkflowTransform(side.transform, side.asset.media, null).dimensions;
    return size.width / size.height > 1.2;
  };
  const moveRail = direction => rail.current?.scrollBy({ left: rail.current.clientWidth * .65 * direction, behavior: layout.reducedMotion ? 'instant' : 'smooth' });
  return <main className="profile-overview system-workflow__token-scope" data-workflow-material="tactile" data-window-chrome="bevel"
    data-lattice-menu-surface data-menu-surface={document.appearance.menuSurfaceId} style={{ '--reception-surround': LATTICE_SURFACES.find(surface => surface.id === 'ash').color }}
    data-published-focus-fallback tabIndex={-1} ref={root} onKeyDown={event => { if (viewerTarget && event.key === 'Escape') { event.preventDefault(); closeWork(); } }} aria-label={`${name} overview`}>
    <div className="profile-overview__inner">
      {unavailableTarget && <p className="profile-overview__notice" role="status">That destination is no longer in this publication. Explore the available work below.</p>}
      <header className="profile-overview__heading identity-module">
        <IdentityTitle address={model.address} profile={official} label={`${official.name}.INSCAPE.ID`} groupedActions />
        <a className="profile-overview__canvas" href={canvasHref()} onClick={event => open(event)}>Canvas</a>
      </header>
      <div className="profile-overview__frame">
      <BentoStage target={viewerTarget} getOrigin={target => tileNodes.current.get(target?.moduleId)} onClose={closeWork} reducedMotion={layout.reducedMotion}
        transition={viewerItem?.kind === 'image' ? 'artwork' : 'panel'}
        renderExpanded={(target, inspection) =>
          <ProfileWorkViewer key={target.moduleId} document={document} target={target} publisherName={name}
            active={sides[target.moduleId] || 0} onActiveChange={index => setSides(current => ({ ...current, [target.moduleId]: index }))}
            readySource={readySources[target.moduleId]} inspection={inspection}
            onClose={closeWork} onOpenCanvas={onOpenCanvas} canvasHref={canvasHref} />
        }>
      <section className="profile-overview__composition" data-expanded={expanded} data-item-count={items.length} aria-label="Profile and published work">
        <article className="profile-overview__identity identity-module" data-artwork={hasArtwork ? 'custom' : 'official'}
          inert={expanded === 'artwork' ? '' : undefined} aria-hidden={expanded === 'artwork' || undefined}>
          {card.background.type === 'clouds' && <IdentityClouds surface={document.appearance.menuSurfaceId} color={card.background.color} speed={card.background.speed} />}
          <IdentityCardBody model={model} card={card} portraitUrl={model.profile.avatarUrl}
            expanded={expanded === 'profile'} onExpandedChange={value => setExpanded(value ? 'profile' : 'compact')}
            expansionControls={null} />
        </article>
        <div className="profile-overview__reveals">
          {card.fields.length > 0 && <button type="button" aria-label={expanded === 'profile' ? 'Collapse INSCAPE details' : 'Expand INSCAPE details'}
            title={expanded === 'profile' ? 'Less info' : 'More info'}
            aria-expanded={expanded === 'profile'} onClick={() => setExpanded(value => value === 'profile' ? 'compact' : 'profile')}>
            {expanded === 'profile' ? <ChevronUp /> : <ChevronDown />}
          </button>}
          {items.length > 0 && <button type="button" aria-label={expanded === 'artwork' ? 'Collapse artwork' : 'Expand artwork'}
            title={expanded === 'artwork' ? 'Less artwork' : 'More artwork'}
            aria-expanded={expanded === 'artwork'} onClick={() => setExpanded(value => value === 'artwork' ? 'compact' : 'artwork')}>
            {expanded === 'artwork' ? <ChevronDown /> : <ChevronUp />}
          </button>}
        </div>
        <div className="profile-overview__gallery" inert={expanded === 'profile' ? '' : undefined} aria-hidden={expanded === 'profile' || undefined}>
        <div className="profile-overview__grid" ref={rail} tabIndex={0} role="region" aria-label="Published artwork carousel" onFocus={event => {
          if (event.target === event.currentTarget || expanded !== 'compact') return;
          const bounds = event.target.getBoundingClientRect(), frame = event.currentTarget.closest('.bento-stage').getBoundingClientRect();
          if (bounds.bottom > frame.bottom + 1) setExpanded('artwork');
        }}>
        {items.map(item => item.kind === 'display' || item.record?.sceneLink ? <div key={item.key}
          className={'profile-overview__tile profile-overview__module' + (item.kind === 'display' ? ' profile-overview__display' : ' profile-overview__linked-text')}
          tabIndex={-1} ref={node => { if (node) tileNodes.current.set(item.key, node); else tileNodes.current.delete(item.key); }}>
          <Suspense fallback={<p role="status">Opening module…</p>}>
            {item.kind === 'display' ? <PublishedDisplayModule document={item.document} instanceId={item.id} Frame={BentoDisplayFrame} active={tools.target === item.id} visible={!viewerTarget && expanded !== 'profile'}
              entryTarget={focusedTarget || returnTarget} reducedMotion={layout.reducedMotion} /> : <BentoLinkedText record={item.record} />}
          </Suspense>
        </div> : <a key={item.key} className={`profile-overview__tile profile-overview__work${item.kind === 'image' ? ' profile-overview__work--image' : ''}`}
          data-wide={wideImage(item) || undefined}
          ref={node => { if (node) tileNodes.current.set(item.key, node); else tileNodes.current.delete(item.key); }} href={workHref(item.target)} onClick={event => {
            if (onEditImage && item.kind === 'image' && plainClick(event)) { event.preventDefault(); onEditImage(item.record, event.currentTarget); }
            else openWork(event, item.target);
          }} aria-label={onEditImage && item.kind === 'image' ? `Edit reception crop for ${item.title}` : `Open ${item.title}`}>
          <ArtworkPreparationProvider viewportRef={root} enabled={viewerTarget?.moduleId === item.key}>
          <TilePreview item={item} side={item.record.sides?.[sides[item.key] || 0]}
            onReady={() => { const id = item.record.sides?.[sides[item.key] || 0]?.asset.media.url;
              setReadySources(current => current[item.key] === id ? current : { ...current, [item.key]: id }); }} />
          </ArtworkPreparationProvider>
          {item.kind === 'text' && <div className="profile-overview__caption"><div><span className="profile-overview__eyebrow">Writing</span><h2>{item.title}</h2></div><ArrowUpRight size={20} aria-hidden="true" /></div>}
        </a>)}
        {items.length === 0 && <p className="profile-overview__empty">No published artwork yet.</p>}
        </div>
        <button className="profile-overview__rail-arrow profile-overview__rail-arrow--previous" type="button" aria-label="Previous artworks" onClick={() => moveRail(-1)}><ChevronLeft /></button>
        <button className="profile-overview__rail-arrow profile-overview__rail-arrow--next" type="button" aria-label="Next artworks" onClick={() => moveRail(1)}><ChevronRight /></button>
        </div>
      </section>
      </BentoStage>
      </div>
    </div>
    <SharedDisplayToolWindows readOnly menuSurface={document.appearance.menuSurfaceId} fallbackFocus={root} />
  </main>;
}
