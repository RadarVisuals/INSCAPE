import React, { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ArtworkSvgDocument from '../src/artwork/ArtworkSvgDocument.jsx';
import ProjectedSvgArtwork from '../src/artwork/ProjectedSvgArtwork.jsx';

const local = '/browser-tests/svg-lifecycle-source.svg';
function Example({ name, projected, src }) {
  const [ready, setReady] = useState(0);
  return <section aria-label={name}><h2>{name}</h2><output aria-label={`${name} ready`}>{ready ? 'Ready' : 'Waiting'}</output>
    <div style={{ width: 280, height: 240, position: 'relative', border: '1px solid #555' }}>
      {projected ? <ProjectedSvgArtwork src={src} width={280} height={240} dimensions={{ width: 280, height: 240 }} onReady={() => setReady(n => n + 1)} />
        : <ArtworkSvgDocument src={src} onReady={() => setReady(n => n + 1)} />}
    </div></section>;
}
function Fixture() {
  const [mounted, setMounted] = useState(true);
  const src = new URLSearchParams(location.search).get('source') || local;
  return <main><h1>SVG lifecycle regression</h1><p>In-memory rendering only. No profile, wallet or draft storage.</p>
    <button onClick={() => setMounted(value => !value)}>{mounted ? 'Unmount artwork' : 'Mount artwork'}</button>
    {mounted && <div style={{ display:'flex', gap: 24, flexWrap:'wrap' }}>
      <Example key={`plain:${src}`} name="Plain host" src={src} />
      <Example key={`projected:${src}`} name="Projected host" src={src} projected />
      <StrictMode><Example key={`strict:${src}`} name="Strict projected host" src={src} projected /></StrictMode>
    </div>}
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
