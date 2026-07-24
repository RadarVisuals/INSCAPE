// src/components/Canvas/ArtCanvas.jsx
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { PixiEngine } from '../../engine/PixiEngine';
import { useStore } from '../../store/useStore';
import { installDevelopmentGlobal, removeDevelopmentGlobal, reportControlledError } from '../../diagnostics.js';

const DEV_DIAGNOSTICS = typeof __DEVELOPMENT_DIAGNOSTICS__ !== 'undefined' && __DEVELOPMENT_DIAGNOSTICS__ === true;

const ArtCanvas = forwardRef(function ArtCanvas({ actorVisible = true, stageVisible = true, foregroundOnly = false, reducedMotion = false, presentationOverride = null, onReady }, ref) {
  const containerRef = useRef(null);
  const engineRef = useRef(null);
  const presentationOverrideRef = useRef(presentationOverride);
  const overrideSubscribersRef = useRef(new Set());
  presentationOverrideRef.current = presentationOverride;
  
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
    moveActorToScreenPosition(clientX, clientY) {
      engineRef.current?.updateMouseClick(clientX, clientY);
    },
    moveActorHorizontallyToScreenPosition(clientX, direction) {
      engineRef.current?.updateHorizontalMove(clientX, direction);
    },
    acknowledgeUserGesture() {
      engineRef.current?.acknowledgeUserGesture();
    },
    getKeeperReactionAvailability() {
      return engineRef.current?.getKeeperReactionAvailability();
    },
    triggerKeeperReaction(reactionType) {
      return engineRef.current?.triggerKeeperReaction(reactionType);
    },
    setStageVisible(visible) {
      return engineRef.current?.setStageVisible(visible);
    }
  }), []);

  useEffect(() => {
    if (engineRef.current || !containerRef.current) return;

    const getPresentationState = () => {
      const state = useStore.getState();
      const override = presentationOverrideRef.current;
      if (!override) return state;
      return { ...state, renderConfig: { ...state.renderConfig,
        actor: { ...state.renderConfig.actor, id: override.keeperId || state.renderConfig.actor.id },
        scene: { ...state.renderConfig.scene,
          environment: override.environment || state.renderConfig.scene.environment,
          background: { ...state.renderConfig.scene.background, backdropId: override.stageId || state.renderConfig.scene.background.backdropId } }
      } };
    };
    const subscribePresentation = (selector, listener, options = {}) => {
      let previous = selector(getPresentationState());
      const emit = () => { const next = selector(getPresentationState()); if (!Object.is(next, previous)) { const before = previous; previous = next; listener(next, before); } };
      const unsubscribeStore = useStore.subscribe(emit);
      overrideSubscribersRef.current.add(emit);
      if (options.fireImmediately) listener(previous, previous);
      return () => { unsubscribeStore(); overrideSubscribersRef.current.delete(emit); };
    };

    // Inject state reading and subscription mechanisms as decoupled dependencies.
    engineRef.current = new PixiEngine(containerRef.current, {
      getState: getPresentationState,
      subscribe: subscribePresentation
    });

    if (DEV_DIAGNOSTICS) installDevelopmentGlobal('__UNDERNEATH_ENGINE__', engineRef.current);

    engineRef.current.setResidentRevealVisible(actorVisible, { reducedMotion });
    engineRef.current.setStageVisible(stageVisible);
    engineRef.current.init().then((ready) => {
      if (ready) onReady?.();
    }).catch((error) => reportControlledError('pixi-boot', error));

    const handleResize = () => { if (engineRef.current) engineRef.current.resize(); };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (engineRef.current) {
        if (DEV_DIAGNOSTICS) removeDevelopmentGlobal('__UNDERNEATH_ENGINE__', engineRef.current);
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  useEffect(() => { overrideSubscribersRef.current.forEach((notify) => notify()); }, [presentationOverride]);

  useEffect(() => {
    engineRef.current?.setResidentRevealVisible(actorVisible, { reducedMotion });
  }, [actorVisible, reducedMotion]);

  useEffect(() => { engineRef.current?.setStageVisible(stageVisible); }, [stageVisible]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      engineRef.current?.updateMousePos(event.clientX, event.clientY);
    };

    // Public spatial surfaces are rendered above Pixi and therefore receive
    // pointer events instead of the canvas. Track at the window boundary so
    // resident eyes, warp, and searchlight remain responsive in every mode.
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

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
        onClick={handleMouseClick}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0, left: 0, zIndex: 1,
          cursor: 'crosshair',
          backgroundColor: foregroundOnly ? 'transparent' : '#050505'
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
            mixBlendMode: 'multiply',
            opacity: foregroundOnly ? 0 : 1
        }}
      />
    </div>
  );
});

export default ArtCanvas;
