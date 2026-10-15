import React, { useId } from 'react';
import { LayerArtwork } from './layersPreview.jsx';
export default function SampleArtwork({ item }) {
  const id = useId();
  if (item.parent === 'display') return <LayerArtwork item={item} />;
  return (
    <svg
      viewBox="0 0 288 192"
      preserveAspectRatio={item.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'}
      style={{ transform: `scale(${(item.cropZoom || 100) / 100})` }}
      aria-hidden="true"
    >
      <defs>
        <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r=".7" fill="#222" />
        </pattern>
      </defs>
      <rect width="288" height="192" fill="#d4d1c8" />
      <circle cx="211" cy="56" r="29" fill="#ecece6" />
      <path d="M30 192V94a58 58 0 0 1 116 0v98Z" fill={item.color} />
      <path d="M116 192V133a65 65 0 0 1 130 0v59Z" fill="#555e55" />
      <rect width="288" height="192" fill={`url(#${id})`} opacity={item.grain / 100} />
    </svg>
  );
}
