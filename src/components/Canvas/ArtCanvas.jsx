// src/components/Canvas/ArtCanvas.jsx
import { useEffect, useRef, useState } from 'react';
import { PixiEngine } from '../../engine/PixiEngine';
import { useStore } from '../../store/useStore';

export default function ArtCanvas() {
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  
  const scanlineOpacity = useStore((state) => state.scanlineOpacity);
  const vignetteOpacity = useStore((state) => state.vignetteOpacity);
  const grapplePrototypeEnabled = useStore((state) => state.grapplePrototypeEnabled);
  const [grappleHud, setGrappleHud] = useState({ state: 'ready', distance: 0, charge: 0, attachedSurface: null });

  useEffect(() => {
    if (engineRef.current || !containerRef.current) return;

    // Inject state reading and subscription mechanisms as decoupled dependencies
    engineRef.current = new PixiEngine(containerRef.current, {
      getState: useStore.getState,
      subscribe: useStore.subscribe
    });

    engineRef.current.init().catch(err => console.error("Failed to boot PixiEngine:", err));

    const handleResize = () => { if (engineRef.current) engineRef.current.resize(); };
    const handleGrappleState = (event) => setGrappleHud(event.detail);
    window.addEventListener('resize', handleResize);
    window.addEventListener('gothic-grapple-state', handleGrappleState);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('gothic-grapple-state', handleGrappleState);
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  const handlePointerMove = (e) => {
    if (engineRef.current) {
      engineRef.current.updateMousePos(e.clientX, e.clientY);
    }
  };

  const handlePointerDown = (e) => {
    if (engineRef.current) {
      engineRef.current.updateMousePos(e.clientX, e.clientY);
      if (grapplePrototypeEnabled) {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        engineRef.current.startGrapple(e.clientY);
      } else {
        engineRef.current.updateMouseClick(e.clientX, e.clientY);
      }
    }
  };

  const handlePointerUp = (e) => {
    if (grapplePrototypeEnabled && engineRef.current) {
      engineRef.current.releaseGrapple();
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      {/* PixiJS Canvas Layer */}
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0, left: 0, zIndex: 1,
          cursor: grapplePrototypeEnabled ? 'grab' : 'crosshair',
          touchAction: 'none',
          userSelect: 'none',
          backgroundColor: '#050505' 
        }}
      />

      {grapplePrototypeEnabled && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none', color: '#fff', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
          <div style={{ position: 'absolute', top: 18, left: 20, fontSize: '12px', letterSpacing: '1px', textShadow: '0 1px 5px #000' }}>
            Distance {grappleHud.distance}
          </div>
          {grappleHud.attachedSurface && (
            <div style={{ position: 'absolute', left: '50%', top: 18, transform: 'translateX(-50%)', width: 'min(280px, 55vw)' }}>
              <div style={{ height: '5px', border: '1px solid rgba(255,255,255,0.6)', background: 'rgba(0,0,0,0.45)' }}>
                <div style={{ height: '100%', width: `${Math.round(grappleHud.charge * 100)}%`, background: grappleHud.attachedSurface === 'ceiling' ? '#00eaff' : '#ff9d00', transition: 'width 40ms linear' }} />
              </div>
              <div style={{ textAlign: 'center', fontSize: '9px', marginTop: '4px', letterSpacing: '1px' }}>Hold tension · release to launch</div>
            </div>
          )}
          {grappleHud.state === 'ready' && (
            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', width: '80vw', textShadow: '0 2px 8px #000' }}>
              <div style={{ fontSize: '18px', letterSpacing: '2px', marginBottom: '10px' }}>Tether Run Prototype</div>
              <div style={{ fontSize: '11px', lineHeight: 1.6, color: '#ddd' }}>Hold upper screen for ceiling · lower screen for floor<br />Release to launch forward</div>
            </div>
          )}
          {grappleHud.state === 'dead' && (
            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', textShadow: '0 2px 8px #000' }}>
              <div style={{ fontSize: '20px', letterSpacing: '2px', marginBottom: '8px' }}>Run Lost</div>
              <div style={{ fontSize: '11px' }}>Distance {grappleHud.distance} · tap to restart</div>
            </div>
          )}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '1px', background: 'rgba(255,255,255,0.035)' }} />
        </div>
      )}

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
