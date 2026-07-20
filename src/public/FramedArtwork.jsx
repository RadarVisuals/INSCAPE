export default function FramedArtwork({ object, asset, style, arranging, selected, compact, editable = false, onActivate, onEdit, containerRef, interactionProps = {}, resizeProps = {}, renderImage }) {
  const name = asset?.name || 'Unavailable artwork';
  return <article ref={containerRef} className="canvas-artwork" data-canvas-object-id={object.id} data-frame={object.presentation.frame} data-mat={object.presentation.mat} data-background={object.presentation.background} data-selected={selected || undefined} data-private={!object.visitorVisible || undefined} style={style}>
    <button type="button" className="canvas-artwork__surface" aria-label={`${arranging ? 'Select' : 'Open'} artwork: ${name}`} onClick={onActivate} {...interactionProps}>
      <span className="canvas-artwork__mat"><span className="canvas-artwork__image-bed">{asset?.thumbnailUrl || asset?.imageUrl ? renderImage?.({ src: asset.thumbnailUrl || asset.imageUrl, alt: name, loading: 'lazy', style: { objectFit: object.presentation.fit }, fallback: <span className="canvas-artwork__missing">Artwork unavailable<br/><small>{object.stableAssetId}</small></span> }) || <img src={asset.thumbnailUrl || asset.imageUrl} alt={name} loading="lazy" style={{ objectFit: object.presentation.fit }} onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.parentElement.dataset.broken = 'true'; }} /> : <span className="canvas-artwork__missing" data-published-image-fallback={renderImage ? true : undefined}>Artwork unavailable<br/><small>{object.stableAssetId}</small></span>}</span></span>
      {arranging && <em>{object.visitorVisible ? 'PUBLIC' : 'PRIVATE'}</em>}
    </button>
    {editable && ((compact && !arranging) || (arranging && selected)) && <button type="button" className="canvas-artwork__edit" onClick={(event) => { event.stopPropagation(); onEdit?.(); }} aria-label={`Edit artwork: ${name}`}>Edit</button>}
    {arranging && <i className="canvas-artwork__resize" data-resize-control aria-label={`Resize artwork: ${name}`} {...resizeProps} />}
  </article>;
}
