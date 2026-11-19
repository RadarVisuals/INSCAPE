import { useId } from 'react';

// A fixed Bayer pattern spreads each small opacity change over adjacent pixels.
// CSS animates one coverage value; the resting matte needs no mask.
const ranks = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export default function CanvasPresentationBackdrop({ backdropRef, dither }) {
  const id = useId();
  return <div ref={backdropRef} className="canvas-presentation-backdrop" aria-hidden="true"
    style={dither ? { '--canvas-matte-mask': `url("#${id}-mask")` } : undefined}>
    {dither && <svg focusable="false">
      <defs>
        <pattern id={id} patternUnits="userSpaceOnUse" width="4" height="4">
          {ranks.map((rank, i) => <rect key={rank} x={i % 4} y={Math.floor(i / 4)} width="1" height="1"
            fill="white" style={{ '--sample-offset': (rank + .5) / ranks.length }} />)}
        </pattern>
        <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
          <rect width="100%" height="100%" fill={`url(#${id})`} />
        </mask>
      </defs>
    </svg>}
  </div>;
}
