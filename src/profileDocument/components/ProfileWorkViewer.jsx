import { lazy, Suspense, useLayoutEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Info, X, ExternalLink } from 'lucide-react';
import { publicReadingPages } from './profileOverviewModel.js';
import { textSurfaceStyle } from '../../text/domain/article.js';
import { projectSystemWorkflowTransform } from '../../systemWorkflow/systemWorkflowTransform.js';
import { imageFocusEntry } from '../../imageModule/imageModule.js';
import DisplayLiftArtwork from '../../public/ownerSystemWorkflow/DisplayLiftArtwork.jsx';
import '../../public/ownerSystemWorkflow/displayInspection.css';
import './profileWorkViewer.css';

const ArticleView = lazy(() => import('../../text/ArticleView.jsx'));

// A single selected module, inside the parent bento stage. Image's canonical
// renderer retains live SVGs and authored orientation; inspection reveals the
// full source with a temporary null crop, never rewriting the saved side.
export default function ProfileWorkViewer({ document: publication, target, publisherName, onClose, onOpenCanvas, canvasHref,
  active = 0, onActiveChange, readySource, inspection }) {
  const pages = useMemo(() => publicReadingPages(publication, target.moduleId), [publication, target.moduleId]);
  const [details, setDetails] = useState(true), [destination, setDestination] = useState(null);
  const page = pages[active] || pages[0];
  const entry = useMemo(() => page?.side ? imageFocusEntry({ ...page.side, crop: page.side.receptionCrop ?? null }) : null, [page]);
  const ready = readySource === page?.side?.asset.media.url;
  useLayoutEffect(() => {
    if (inspection?.closing && !ready) inspection.onClosed();
  }, [inspection?.closing, ready]);
  if (!page) return null;
  const asset = page.side?.asset;
  const dimensions = asset ? projectSystemWorkflowTransform(page.side.transform, asset.media, null).dimensions : null;
  const title = asset?.name || page.title;
  const navigate = direction => onActiveChange((active + direction + pages.length) % pages.length);
  return <section className="profile-work-viewer" data-workflow-material="tactile" aria-label={title}>
    <header className="profile-work-viewer__heading">
      <span>{asset ? 'Artwork' : 'Writing'}</span><h2>{title}</h2>
      <button type="button" className="workflow-tactile-control profile-work-viewer__key" aria-label="Close work viewer" title="Close · Escape" onClick={onClose}><X /></button>
    </header>
    <div className="profile-work-viewer__body" data-details={details || undefined}>
      {asset ? <div className="profile-work-viewer__media" aria-label="Complete artwork">
        <div ref={setDestination} className="profile-work-viewer__fitted" style={{ '--media-ratio': dimensions.width / dimensions.height }} data-fitted-artwork />
        {ready && inspection?.scene && destination && <DisplayLiftArtwork scene={inspection.scene}
          source={inspection.source?.querySelector('[data-image-source]')} destination={destination} entry={entry}
          closing={inspection.closing} reducedMotion={inspection.reducedMotion}
          dimmingTarget={inspection.layer} onCloseComplete={inspection.onClosed} />}
      </div> : <div className="profile-work-viewer__article" style={textSurfaceStyle(page.article)} tabIndex={0}>
        <Suspense fallback={<p role="status">Loading article…</p>}><ArticleView article={page.article} /></Suspense>
      </div>}
      {details && <aside className="profile-work-viewer__details" aria-label="Work information" tabIndex={0}>
        <h3>{title}</h3>{asset?.description && <p>{asset.description}</p>}
        <dl>
          <div><dt>Type</dt><dd>{asset ? 'Image' : 'Text'}</dd></div>
          {asset?.collectionName && <div><dt>Collection</dt><dd>{asset.collectionName}</dd></div>}
          {asset?.contractAddress && <div><dt>Contract</dt><dd>{asset.contractAddress}</dd></div>}
          {asset?.tokenId && <div><dt>Token ID</dt><dd>{asset.tokenId}</dd></div>}
          {(asset?.creators || []).map((creator, index) => <div key={index}><dt>Creator · {creator.source} / {creator.scope}</dt><dd>{creator.name || creator.address}</dd></div>)}
          <div><dt>Published by</dt><dd>{publisherName}</dd></div>
          <div><dt>Profile</dt><dd>{publication.profile.address}</dd></div>
        </dl>
      </aside>}
    </div>
    <footer className="profile-work-viewer__navigation">
      <div className="profile-work-viewer__toolbar" role="toolbar" aria-label="Work navigation">
        {pages.length > 1 && <>
          <button type="button" className="workflow-tactile-control profile-work-viewer__key" aria-label="Previous side" onClick={() => navigate(-1)}><ArrowLeft /></button>
          <span className="profile-work-viewer__counter" aria-live="polite">{active + 1} / {pages.length}</span>
          <button type="button" className="workflow-tactile-control profile-work-viewer__key" aria-label="Next side" onClick={() => navigate(1)}><ArrowRight /></button>
        </>}
        <button type="button" className="workflow-tactile-control profile-work-viewer__key" aria-label="Artwork details" title="Details" aria-pressed={details} onClick={() => setDetails(value => !value)}><Info /></button>
        <a className="workflow-tactile-control profile-work-viewer__key" aria-label="Open current work on canvas" title="Open on canvas" href={canvasHref(page.target)} onClick={event => {
          if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && onOpenCanvas) { event.preventDefault(); onOpenCanvas(page.target); }
        }}><ExternalLink /></a>
        <button type="button" className="workflow-tactile-control profile-work-viewer__key" aria-label="Return to card" title="Return to card · Escape" onClick={onClose}><X /></button>
      </div>
    </footer>
  </section>;
}
