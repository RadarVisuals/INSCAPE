// src/App.jsx
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  APPLICATION_MODES,
  createApplicationModeUrl,
  resolveApplicationMode
} from './app/appMode.js';
import ArtCanvas from './components/Canvas/ArtCanvas';
import PublicShell from './public/PublicShell.jsx';

const AtelierExperience = lazy(() => import('./app/AtelierExperience.jsx'));

function AtelierLoadingFallback() {
  return <div className="mode-loading" role="status">Opening Atelier…</div>;
}

function App() {
  const canvasRef = useRef(null);
  const [applicationMode, setApplicationMode] = useState(() => resolveApplicationMode(window.location));

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

  const setResidentHabitat = useCallback((bounds, options) => {
    canvasRef.current?.setResidentHabitat(bounds, options);
  }, []);

  return (
    <div className="application-root" data-application-mode={applicationMode}>
      <ArtCanvas ref={canvasRef} />
      {applicationMode === APPLICATION_MODES.ATELIER ? (
        <Suspense fallback={<AtelierLoadingFallback />}>
          <AtelierExperience
            onRequestPublic={() => changeApplicationMode(APPLICATION_MODES.PUBLIC)}
          />
        </Suspense>
      ) : (
        <PublicShell
          onRequestAtelier={() => changeApplicationMode(APPLICATION_MODES.ATELIER)}
          onResidentHabitatChange={setResidentHabitat}
        />
      )}
    </div>
  );
}

export default App;
