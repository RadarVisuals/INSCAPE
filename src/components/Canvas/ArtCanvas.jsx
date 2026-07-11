// src/components/Canvas/ArtCanvas.jsx
import { useEffect, useRef } from 'react';
import { PixiEngine } from '../../engine/PixiEngine';
import { useStore } from '../../store/useStore';

export default function ArtCanvas() {
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  
  // Grab overlay params from store
  const scanlineOpacity = useStore((state) => state.scanlineOpacity);
  const vignetteOpacity = useStore((state) => state.vignetteOpacity);

  useEffect(() => {
    if (engineRef.current || !containerRef.current) return;
    engineRef.current = new PixiEngine(containerRef.current);
    engineRef.current.init().catch(err => console.error("Failed to boot PixiEngine:", err));

    const handleResize = () => { if (engineRef.current) engineRef.current.resize(); };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  const handleMouseMove = (e) => {
    // Pass raw screen coordinates. PixiEngine converts these into local targets [3].
    if (engineRef.current) {
      engineRef.current.updateMousePos(e.clientX, e.clientY);
    }
  };

  const handleMouseClick = (e) => {
    // Pass click position to drift the character to the destination [3]
    if (engineRef.current) {
      engineRef.current.updateMouseClick(e.clientX, e.clientY);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      {/* PixiJS Container */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onClick={handleMouseClick}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0, left: 0, zIndex: 1,
          cursor: 'crosshair',
          backgroundColor: '#050505' 
        }}
      />

      {/* Screen Overlay (Vignette & Scanlines) */}
      <div 
        style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: 10,
            background: `
              radial-gradient(circle, transparent 35%, rgba(0,0,0,${vignetteOpacity}) 100%),
              repeating-linear-gradient(rgba(0,0,0,${scanlineOpacity}) 0px, rgba(0,0,0,${scanlineOpacity}) 1px, transparent 1px, transparent 3px)
            `,
            mixBlendMode: 'multiply'
        }}
      />
    </div>
  );
}