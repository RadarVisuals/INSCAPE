export default function FramedArtwork({ object, asset, style, arranging, selected, compact, editable = false, transparent = false, resolving = false, onActivate, onEdit, onContextMenu, containerRef, interactionProps = {}, resizeProps = {}, renderImage }) {
  const name = asset?.name || (resolving ? 'Resolving artwork' : 'Unavailable artwork');
  const transparentPresentation = transparent || object.presentation.background === 'transparent';
  const artworkSource = transparentPresentation ? asset?.imageUrl || asset?.thumbnailUrl : asset?.thumbnailUrl || asset?.imageUrl;
  return <article ref={containerRef} className="canvas-artwork" data-canvas-object-id={object.id} data-frame={object.presentation.frame} data-mat={object.presentation.mat} data-background={object.presentation.background} data-transparent={transparentPresentation || undefined} data-selected={selected || undefined} data-locked={object.locked || undefined} data-private={!object.visitorVisible || undefined} style={style} onContextMenu={onContextMenu}>
    <button type="button" className="canvas-artwork__surface" aria-label={`${arranging ? 'Select' : 'Open'} artwork: ${name}`} onClick={onActivate} {...interactionProps}>
      <span className="canvas-artwork__mat"><span className="canvas-artwork__image-bed">{artworkSource ? renderImage?.({ src: artworkSource, alt: name, loading: 'lazy', style: { objectFit: object.presentation.fit }, fallback: <span className="canvas-artwork__missing">Artwork unavailable<br/><small>{object.stableAssetId}</small></span> }) || <img src={artworkSource} alt={name} loading="lazy" style={{ objectFit: object.presentation.fit }} onError={(event) => { event.currentTarget.hidden = true; event.currentTarget.parentElement.dataset.broken = 'true'; }} /> : <span className="canvas-artwork__missing" data-published-image-fallback={renderImage ? true : undefined}>{resolving ? 'Resolving artwork' : 'Artwork unavailable'}<br/><small>{object.stableAssetId}</small></span>}</span></span>
      {arranging && <em>{object.visitorVisible ? 'PUBLIC' : 'PRIVATE'}</em>}
    </button>
    {editable && ((compact && !arranging) || (arranging && selected)) && <button type="button" className="canvas-artwork__edit" onClick={(event) => { event.stopPropagation(); onEdit?.(); }} aria-label={`Edit artwork: ${name}`}>Edit</button>}
    {arranging && selected && <i className="canvas-artwork__resize" data-resize-control aria-label={`Resize artwork: ${name}`} {...resizeProps} />}
  </article>;
}
