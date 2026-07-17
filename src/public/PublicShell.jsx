import { useEffect, useMemo, useReducer, useRef } from 'react';
import { Archive, Fingerprint, Radio, Sparkles, X } from 'lucide-react';
import IdentityWindow from './IdentityWindow.jsx';
import { DEFAULT_PUBLIC_THEME } from './themeTokens.js';
import { initialWindowState, publicWindowReducer } from './windows/windowState.js';
import './publicShell.css';

const APPLICATIONS = Object.freeze([
  { id: 'identity', label: 'Identity', code: 'Resident', Icon: Fingerprint },
  { id: 'collection', label: 'Collection', code: 'AR.02', Icon: Archive },
  { id: 'creations', label: 'Creations', code: 'MK.03', Icon: Sparkles },
  { id: 'signals', label: 'Signals', code: 'RX.04', Icon: Radio }
]);

function PlaceholderWindow({ name }) {
  return (
    <div className="placeholder-window">
      <p>Application boundary established</p>
      <h2>{name}</h2>
      <span>Content remains intentionally unformed in this shell phase.</span>
    </div>
  );
}

export default function PublicShell({ onRequestAtelier, onResidentHabitatChange }) {
  const [windowState, dispatch] = useReducer(publicWindowReducer, initialWindowState);
  const launcherRefs = useRef(new Map());
  const windowRefs = useRef(new Map());
  const previousIdsRef = useRef([]);

  const applicationsById = useMemo(
    () => new Map(APPLICATIONS.map((application) => [application.id, application])),
    []
  );

  useEffect(() => {
    const previousIds = previousIdsRef.current;
    const openedId = windowState.openIds.find((id) => !previousIds.includes(id));
    if (openedId) windowRefs.current.get(openedId)?.focus();

    const closedId = previousIds.find((id) => !windowState.openIds.includes(id));
    if (closedId) launcherRefs.current.get(closedId)?.focus();

    previousIdsRef.current = windowState.openIds;
  }, [windowState.openIds]);

  useEffect(() => {
    const closeActiveWindow = (event) => {
      if (event.key === 'Escape' && windowState.activeId) {
        dispatch({ type: 'close', id: windowState.activeId });
      }
    };
    window.addEventListener('keydown', closeActiveWindow);
    return () => window.removeEventListener('keydown', closeActiveWindow);
  }, [windowState.activeId]);

  return (
    <main
      className="public-shell"
      data-application-mode="public"
      data-identity-open={windowState.openIds.includes('identity') || undefined}
      style={DEFAULT_PUBLIC_THEME}
      aria-label="UNDERNEATH.OS public world"
    >
      <header className="public-shell__masthead">
        <div>
          <p>Living profile world</p>
          <h1>UNDERNEATH<span>.OS</span></h1>
        </div>
        <button className="mode-switch" type="button" onClick={onRequestAtelier}>
          Open Atelier <span aria-hidden="true">↗</span>
        </button>
      </header>

      <section className="launcher-field" aria-label="Applications">
        {APPLICATIONS.map(({ id, label, code, Icon }, index) => {
          const isOpen = windowState.openIds.includes(id);
          const isActive = windowState.activeId === id;
          return (
            <button
              className="application-launcher"
              data-application-id={id}
              data-launcher-index={index}
              data-active={isActive || undefined}
              key={id}
              type="button"
              aria-controls={`public-window-${id}`}
              aria-expanded={isOpen}
              aria-label={`Open ${label}`}
              ref={(node) => {
                if (node) launcherRefs.current.set(id, node);
                else launcherRefs.current.delete(id);
              }}
              onClick={() => dispatch({ type: 'open', id })}
            >
              <span className="application-launcher__code">{code}</span>
              <span className="application-launcher__artifact" aria-hidden="true">
                <Icon strokeWidth={1.25} />
              </span>
              <span className="application-launcher__label">{label}</span>
              <span className="application-launcher__state">
                {isOpen ? (isActive ? 'Active' : 'Open') : 'Launch'}
              </span>
            </button>
          );
        })}
      </section>

      <div className="window-layer" aria-live="polite">
        {windowState.openIds.map((id, stackIndex) => {
          const application = applicationsById.get(id);
          const isActive = id === windowState.activeId;
          return (
            <section
              className={`public-window${id === 'identity' ? ' public-window--identity' : ''}`}
              data-active={isActive || undefined}
              id={`public-window-${id}`}
              key={id}
              role="dialog"
              aria-modal="false"
              aria-labelledby={`public-window-title-${id}`}
              tabIndex={-1}
              ref={(node) => {
                if (node) windowRefs.current.set(id, node);
                else windowRefs.current.delete(id);
              }}
              style={{ zIndex: stackIndex + 1 }}
              onPointerDown={() => dispatch({ type: 'focus', id })}
              onFocusCapture={() => {
                if (!isActive) dispatch({ type: 'focus', id });
              }}
            >
              {id !== 'identity' && (
                <header className="public-window__titlebar">
                  <div>
                    <span>{application.code}</span>
                    <h2 id={`public-window-title-${id}`}>{application.label}</h2>
                  </div>
                  <p>{isActive ? 'Receiving focus' : 'Inactive layer'}</p>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'close', id })}
                    aria-label={`Close ${application.label}`}
                  >
                    <X aria-hidden="true" />
                  </button>
                </header>
              )}
              <div className="public-window__content">
                {id === 'identity'
                  ? (
                    <IdentityWindow
                      titleId={`public-window-title-${id}`}
                      onClose={() => dispatch({ type: 'close', id })}
                      onHabitatChange={onResidentHabitatChange}
                    />
                  )
                  : <PlaceholderWindow name={application.label} />}
              </div>
            </section>
          );
        })}
      </div>

      <footer className="public-shell__footer" aria-hidden="true">
        <span>World channel / awake</span>
        <span>{String(windowState.openIds.length).padStart(2, '0')} surfaces open</span>
      </footer>
    </main>
  );
}
