import LibraryArtworkImage from '../ownerSystemWorkflow/LibraryArtworkImage.jsx';
import ArtworkSvgDocument from '../../artwork/ArtworkSvgDocument.jsx';
import useSvgArtwork from '../../artwork/useSvgArtwork.js';

// The selected avatar remains the source. Only its large portrait gets an
// executable document; thumbnails must not create additional RPC listeners.
export default function IdentityPortrait({ src, interactive, title, onError }) {
  const svg = useSvgArtwork(interactive ? src : null);
  if (interactive && svg) return <ArtworkSvgDocument key={src} src={src} title={title} className="identity-module__portrait-document" />;
  return <LibraryArtworkImage key={src} alt="" draggable={false} src={src} onError={onError} />;
}
