// src/App.jsx
import { useCallback, useEffect, useState } from 'react';
import {
  APPLICATION_MODES,
  createApplicationModeUrl,
  resolveApplicationMode
} from './app/appMode.js';
import AtelierExperience from './app/AtelierExperience.jsx';
import ArtCanvas from './components/Canvas/ArtCanvas';
import PublicShell from './public/PublicShell.jsx';

function App() {
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

  return (
    <div className="application-root" data-application-mode={applicationMode}>
      <ArtCanvas />
      {applicationMode === APPLICATION_MODES.ATELIER ? (
        <AtelierExperience
          onRequestPublic={() => changeApplicationMode(APPLICATION_MODES.PUBLIC)}
        />
      ) : (
        <PublicShell
          onRequestAtelier={() => changeApplicationMode(APPLICATION_MODES.ATELIER)}
        />
      )}
    </div>
  );
}

export default App;
