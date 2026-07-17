// src/components/Canvas/ArtCanvas.jsx
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { PixiEngine } from '../../engine/PixiEngine';
import { useStore } from '../../store/useStore';

const ArtCanvas = forwardRef(function ArtCanvas({ actorVisible = true, reducedMotion = false, onReady }, ref) {
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  
  const screenEffects = useStore((state) => state.renderConfig.effects.screen);

  useImperativeHandle(ref, () => ({
    startResidentHandoff(bounds, options = {}) {
      return engineRef.current?.startResidentHandoff(bounds, options);
    },
    updateResidentHandoffBounds(bounds) {
      return engineRef.current?.updateResidentHandoffBounds(bounds);
    },
    exitResidentHandoff(bounds, options = {}) {
      return engineRef.current?.exitResidentHandoff(bounds, options);
    },
    cancelResidentHandoff() {
      engineRef.current?.cancelResidentHandoff();
    },
    setActorScreenPositionTarget(target) {
      engineRef.current?.setActorScreenPositionTarget(target);
    },
    acknowledgeUserGesture() {
      engineRef.current?.acknowledgeUserGesture();
    },
    getKeeperReactionAvailability() {
      return engineRef.current?.getKeeperReactionAvailability();
    },
    triggerKeeperReaction(reactionType) {
      return engineRef.current?.triggerKeeperReaction(reactionType);
    }
  }), []);

  useEffect(() => {
    if (engineRef.current || !containerRef.current) return;

    // Inject state reading and subscription mechanisms as decoupled dependencies
    engineRef.current = new PixiEngine(containerRef.current, {
      getState: useStore.getState,
      subscribe: useStore.subscribe
    });

    if (import.meta.env.DEV) window.__UNDERNEATH_ENGINE__ = engineRef.current;

    engineRef.current.setResidentRevealVisible(actorVisible, { reducedMotion });
    engineRef.current.init().then((ready) => {
      if (ready) onReady?.();
    }).catch(err => console.error("Failed to boot PixiEngine:", err));

    const handleResize = () => { if (engineRef.current) engineRef.current.resize(); };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (engineRef.current) {
        if (import.meta.env.DEV && window.__UNDERNEATH_ENGINE__ === engineRef.current) {
          delete window.__UNDERNEATH_ENGINE__;
        }
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setResidentRevealVisible(actorVisible, { reducedMotion });
  }, [actorVisible, reducedMotion]);

  const handleMouseMove = (e) => {
    if (engineRef.current) {
      engineRef.current.updateMousePos(e.clientX, e.clientY);
    }
  };

  const handleMouseClick = (e) => {
    if (engineRef.current) {
      engineRef.current.updateMouseClick(e.clientX, e.clientY);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      {/* PixiJS Canvas Layer */}
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
              radial-gradient(circle, transparent 35%, rgba(0,0,0,${screenEffects.vignetteOpacity}) 100%),
              repeating-linear-gradient(rgba(0,0,0,${screenEffects.scanlineOpacity}) 0px, rgba(0,0,0,${screenEffects.scanlineOpacity}) 1px, transparent 1px, transparent 3px)
            `,
            mixBlendMode: 'multiply'
        }}
      />
    </div>
  );
});

export default ArtCanvas;
