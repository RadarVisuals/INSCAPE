// src/App.jsx
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APPLICATION_MODES,
  createApplicationModeUrl,
  resolveApplicationMode
} from './app/appMode.js';
import ArtCanvas from './components/Canvas/ArtCanvas';
import ModuleGridShell from './public/ModuleGridShell.jsx';
import { AssetResolver } from './engine/assets/AssetResolver.js';
import { Startveil } from './startveil/index.js';
import { useStore } from './store/useStore.js';

const AtelierExperience = lazy(() => import('./app/AtelierExperience.jsx'));

function AtelierLoadingFallback() {
  return <div className="mode-loading" role="status">Opening Atelier…</div>;
}

function App() {
  const canvasRef = useRef(null);
  const [applicationMode, setApplicationMode] = useState(() => resolveApplicationMode(window.location));
  const [worldReady, setWorldReady] = useState(false);
  const [revealStage, setRevealStage] = useState('sealed');
  const [revealPresentation, setRevealPresentation] = useState({
    sequence: 'full',
    reducedMotion: false
  });
  const activeActorId = useStore((state) => state.renderConfig.actor.id);
  const worldVisible = ['world', 'resident', 'interface', 'complete'].includes(revealStage);
  const actorVisible = ['resident', 'interface', 'complete'].includes(revealStage);
  const interfaceVisible = ['interface', 'complete'].includes(revealStage);

  useEffect(() => {
    const syncModeFromUrl = () => setApplicationMode(resolveApplicationMode(window.location));
    window.addEventListener('popstate', syncModeFromUrl);
    return () => window.removeEventListener('popstate', syncModeFromUrl);
  }, []);

  const changeApplicationMode = useCallback((mode) => {
    const nextUrl = createApplicationModeUrl(window.location, mode);
    window.history.pushState({ applicationMode: mode }, '', nextUrl);
    setApplicationMode(mode);
  }, []);

  const residentHandoff = useMemo(() => ({
    start(bounds, options) {
      return canvasRef.current?.startResidentHandoff(bounds, options);
    },
    updateBounds(bounds) {
      return canvasRef.current?.updateResidentHandoffBounds(bounds);
    },
    exit(bounds, options) {
      return canvasRef.current?.exitResidentHandoff(bounds, options);
    },
    cancel() {
      canvasRef.current?.cancelResidentHandoff();
    },
    trackActorPosition(target) {
      canvasRef.current?.setActorScreenPositionTarget(target);
    }
  }), []);

  const keeperReactions = useMemo(() => ({
    getAvailability() {
      return canvasRef.current?.getKeeperReactionAvailability?.();
    },
    trigger(reactionType) {
      return canvasRef.current?.triggerKeeperReaction?.(reactionType);
    }
  }), []);

  const handleUserGesture = useCallback(() => {
    canvasRef.current?.acknowledgeUserGesture();
  }, []);

  return (
    <div className="application-root" data-application-mode={applicationMode} data-startveil-stage={revealStage}>
      <div className="application-world" data-visible={worldVisible || undefined}>
        <ArtCanvas
          ref={canvasRef}
          actorVisible={actorVisible}
          reducedMotion={revealPresentation.reducedMotion}
          onReady={() => setWorldReady(true)}
        />
      </div>
      <div
        className="application-interface"
        data-visible={interfaceVisible || undefined}
        aria-hidden={!interfaceVisible}
        inert={interfaceVisible ? undefined : ''}
      >
        {applicationMode === APPLICATION_MODES.ATELIER ? (
          <Suspense fallback={<AtelierLoadingFallback />}>
            <AtelierExperience onRequestPublic={() => changeApplicationMode(APPLICATION_MODES.PUBLIC)} />
          </Suspense>
        ) : (
          <ModuleGridShell
            onRequestAtelier={() => changeApplicationMode(APPLICATION_MODES.ATELIER)}
            activeActorId={activeActorId}
            avatarSrc={AssetResolver.resolveActorAvatarPath(activeActorId)}
            residentHandoff={residentHandoff}
            keeperReactions={keeperReactions}
            interfaceVisible={interfaceVisible}
            revealPresentation={revealPresentation}
          />
        )}
      </div>
      <Startveil
        ready={worldReady}
        onUserGesture={handleUserGesture}
        onPresentationMode={setRevealPresentation}
        onRevealWorld={() => setRevealStage('world')}
        onRevealActor={() => setRevealStage('resident')}
        onRevealInterface={() => setRevealStage('interface')}
        onComplete={() => setRevealStage('complete')}
      />
    </div>
  );
}

export default App;
