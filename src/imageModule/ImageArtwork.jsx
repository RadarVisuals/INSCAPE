import { artworkPreview } from '../library/data/libraryImagePreview.js';
import { cloneElement, memo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { projectSystemWorkflowTransform, projectSystemWorkflowImageRenderRectangle } from '../systemWorkflow/systemWorkflowTransform.js';
import { projectCroppedMediaRectangle } from '../lattice/rendering/latticeCrop.js';
import { fitNativeMediaRectangle, alignContainedMediaRectangle } from '../lattice/rendering/latticeGeometry.js';
import { resolvePublishedAssetUrl } from '../profileDocument/domain/publishedAssetUrl.js';
import { useArtworkMediaType } from '../artwork/useSvgArtwork.js';
import ProjectedSvgArtwork from '../artwork/ProjectedSvgArtwork.jsx';
import { usePreparedImageArtwork } from './usePreparedImageArtwork.js';

// One SVG viewport owns projection and clipping, in canvas coordinates.
export default memo(function ImageArtwork(props) {
  const src = resolvePublishedAssetUrl(props.artwork.asset.media.url);
  const [attempt, setAttempt] = useState(0);
  // Retry only this artwork's media. Remounting its attempt also cancels type
  // detection and disposable WebP preparation, without replacing the artwork plane.
  return <ImageArtworkAttempt key={`${src}:${attempt}`} {...props} src={src}
    onRetry={() => setAttempt(current => current === attempt ? current + 1 : current)} />;
});

function ImageArtworkAttempt({ artwork, src, rectangle, alignment, crop = artwork.crop, recoveryHost, recoveryMode, onRetry, onRecoverFocus, htmlSvgViewport = false, inspecting = false }) {
  const media = artwork.asset.media;
  const preview = artworkPreview(src);
  const { svg, pending } = useArtworkMediaType(src);
  // The keyed attempt owns one source for its entire lifetime.
  const [loadState, setLoadState] = useState({ status: 'loading', show: false });
  const raster = usePreparedImageArtwork(src, !pending && !svg && !inspecting && loadState.status === 'ready');
  useEffect(() => {
    if (pending || svg) return undefined;
    let active = true;
    setLoadState({ status: 'loading', show: false });
    const image = new Image(); image.decoding = 'async'; image.src = src;
    // Loading an SVG <image> is not proof that its bitmap has been decoded.
    // Each mounted source owns a bounded decoder and its recovery state.
    const loading = setTimeout(() => { if (active) setLoadState({ status: 'loading', show: true }); }, 180);
    const finish = status => {
      if (!active) return;
      active = false; clearTimeout(loading); clearTimeout(timeout);
      setLoadState({ status, show: true });
      if (status === 'failed') image.removeAttribute('src');
    };
    const timeout = setTimeout(() => finish('failed'), 15000);
    image.decode().then(() => finish('ready')).catch(() => finish('failed'));
    return () => { active = false; clearTimeout(loading); clearTimeout(timeout); image.removeAttribute('src'); };
  }, [src, pending, svg]);
  const status = loadState.status;
  const projection = projectSystemWorkflowTransform(artwork.transform, media, crop);
  const { quarterTurns, mirrorX, mirrorY } = artwork.transform;
  const fitted = crop ? alignContainedMediaRectangle(rectangle, projectCroppedMediaRectangle(rectangle, projection.dimensions, projection.crop), alignment)
    : fitNativeMediaRectangle(rectangle, projection.dimensions, alignment);
  const image = projectSystemWorkflowImageRenderRectangle(fitted, projection);
  // Status belongs beside the canvas button, outside transformed artwork and
  // its interaction tree. SVG retains its existing loader and retry lifecycle.
  const renderStatus = (node, state) => recoveryHost ? createPortal(recoveryMode === 'inspect'
    ? <span className="image-module__inspection-status" role="status" data-artwork-loading={state === 'loading' || undefined}>{state === 'loading' ? 'Loading artwork…' : 'Artwork unavailable. Return to Image to retry.'}</span>
    : cloneElement(node, {
    className: 'image-module__status image-module__recovery-status',
    'data-artwork-loading': state === 'loading' || undefined,
    onPointerDown: event => event.stopPropagation(),
    onClick: event => {
      event.stopPropagation();
      // Return focus only when Retry removes the currently focused button.
      // A later load result must never steal newer focus.
      const button = event.target.closest('button');
      if (button && document.activeElement === button) {
        onRecoverFocus?.();
      }
    },
    onDoubleClick: event => event.stopPropagation(),
    onKeyDown: event => event.stopPropagation(),
  }), recoveryHost) : null;
  if (svg) return <ProjectedSvgArtwork src={src} width={rectangle.width} height={rectangle.height}
    dimensions={media} mediaStyle={{ ...image, transform: projection.css }} renderStatus={renderStatus} htmlViewport={htmlSvgViewport} inspecting={inspecting} />;
  return <><svg className="image-module__artwork" data-media-state={status} viewBox={`0 0 ${rectangle.width} ${rectangle.height}`} preserveAspectRatio="none" aria-hidden="true">
    <image ref={raster} href={status === 'ready' || !preview ? src : preview.url} x={image.left} y={image.top} width={image.width} height={image.height}
      preserveAspectRatio="none" transform={`translate(${fitted.left + fitted.width / 2} ${fitted.top + fitted.height / 2}) scale(${mirrorX ? -1 : 1} ${mirrorY ? -1 : 1}) rotate(${quarterTurns * 90}) translate(${-image.left - image.width / 2} ${-image.top - image.height / 2})`} />
  </svg>
    {status !== 'ready' && loadState.show && (!preview || status === 'failed')
      && renderStatus(<span role="status">
        {status === 'failed' ? <>Artwork unavailable.<button type="button" className="workflow-tactile-control"
          data-workbench-recovery-control onClick={onRetry}>Retry artwork</button></> : 'Loading artwork…'}
      </span>, status)}
  </>;
}
