import { projectDisplayArtworkOpening } from './displayArtworkOpening.js';
import './displayArtworkSurface.css';
import useSvgArtwork from '../../artwork/useSvgArtwork.js';
import ProjectedSvgArtwork from '../../artwork/ProjectedSvgArtwork.jsx';

// Keep media loading, decoding and animation in the original image element.
// Crop its source rectangle before painting, instead of stacking independent
// antialiased CSS clips around separately transformed image layers.
export default function DisplayArtworkSurface({ children, width, height, dimensions, mediaStyle, src, onReady }) {
  const svg = useSvgArtwork(src);
  const opening = mediaStyle && width > 0 && height > 0
    ? projectDisplayArtworkOpening(mediaStyle, width, height,
      new DOMMatrix(mediaStyle.transform === 'none' ? undefined : mediaStyle.transform)) : null;
  if (svg) return <span className="display-artwork-surface"><ProjectedSvgArtwork src={src}
    width={width} height={height} dimensions={dimensions} mediaStyle={mediaStyle} onReady={onReady} /></span>;
  return <span className="display-artwork-surface" style={opening ? {
    '--display-media-left': `${opening.left}px`, '--display-media-top': `${opening.top}px`,
    '--display-media-width': `${opening.width}px`, '--display-media-height': `${opening.height}px`,
    '--display-media-viewbox': `inset(${opening.insets.map(value => `${value * 100}%`).join(' ')})`,
  } : undefined}>{children}</span>;
}
