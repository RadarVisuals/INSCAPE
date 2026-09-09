import { useEffect, useRef } from 'react';
import { luksoProfileDiscoveryRepository } from './data/luksoProfileDiscoveryRepository.js';
import useProfileDiscoveryController from './useProfileDiscoveryController.js';
import '../lattice/rendering/latticeMenuSurface.css';
import './inscapeDirectorySystemWorkflow.css';

const abbreviate = (address) => address ? `${address.slice(0, 8)}…${address.slice(-6)}` : '';
const initials = (result) => (result.name || 'UP').split(/\s+/u).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
function optionId(result) { return `inscape-directory-${result.address.slice(2)}`; }
function Result({ result, active, onFocus, onSelect, optionRef }) {
  return <button ref={optionRef} id={optionId(result)} type="button" role="option" aria-selected={active} tabIndex={active ? 0 : -1}
    className="profile-discovery__result" onFocus={onFocus} onClick={onSelect}>
    <span className="profile-discovery__avatar">{result.avatarUrl ? <img src={result.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <span aria-hidden="true">{initials(result)}</span>}</span>
    <span className="profile-discovery__result-copy"><strong>{result.name || 'Unnamed profile'}</strong>
      <code title={result.address}>{abbreviate(result.address)}</code><small>Published INSCAPE workspace</small></span>
  </button>;
}

export default function ProfileDiscovery({ menuSurfaceId = 'mist', onClose, onSelect, repository = luksoProfileDiscoveryRepository }) {
  const {
    activeIndex, error, moveActive: moveControllerActive, profiles, query, resolveSelection, results,
    retry, setActiveIndex, setQuery, status,
  } = useProfileDiscoveryController({ repository });
  const displayStatus = status === 'idle' ? 'loading' : status;
  const inputRef = useRef(null); const dialogRef = useRef(null);
  const optionRefs = useRef(new Map());
  const previousFocusRef = useRef(document.activeElement);
  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      const restoreFocus = () => {
        const previous = previousFocusRef.current;
        const target = previous?.isConnected ? previous : document.querySelector('[data-published-focus-fallback]');
        target?.focus?.();
      };
      if (globalThis.requestAnimationFrame) globalThis.requestAnimationFrame(restoreFocus); else globalThis.setTimeout(restoreFocus, 0);
    };
  }, []);
  const choose = (result = null) => { const selected = resolveSelection(result); if (selected) onSelect(selected); };
  const moveActive = (offset) => {
    const next = moveControllerActive(offset);
    if (next && document.activeElement?.classList.contains('profile-discovery__result')) {
      globalThis.requestAnimationFrame?.(() => optionRefs.current.get(next.address)?.focus());
    }
  };
  const onKeyDown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
    if (event.key === 'ArrowDown' && results.length) { event.preventDefault(); moveActive(1); }
    if (event.key === 'ArrowUp' && results.length) { event.preventDefault(); moveActive(-1); }
    if (event.key === 'Enter' && results.length && event.target === inputRef.current) { event.preventDefault(); choose(); }
    if (event.key === 'Tab') { const focusable = [...dialogRef.current.querySelectorAll('input,button:not(:disabled)')]; if (!focusable.length) return;
      const edge = event.shiftKey ? focusable[0] : focusable.at(-1); if (document.activeElement === edge) { event.preventDefault(); (event.shiftKey ? focusable.at(-1) : focusable[0]).focus(); } }
  };
  return <div className="profile-discovery" data-lattice-menu-surface data-menu-surface={menuSurfaceId} role="presentation"
    onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="profile-discovery__panel" role="dialog" aria-modal="true" aria-labelledby="profile-discovery-title" onKeyDown={onKeyDown}>
      <header><div><p>INSCAPE / PUBLIC DIRECTORY</p><h2 id="profile-discovery-title">Explore worlds</h2></div><button type="button" onClick={onClose} aria-label="Close INSCAPE directory">×</button></header>
      <label className="profile-discovery__search"><span className="sr-only">Search published workspaces</span><input ref={inputRef} type="search" role="combobox" aria-autocomplete="list" aria-expanded={results.length > 0} aria-controls="inscape-directory-results" aria-activedescendant={results[activeIndex] ? optionId(results[activeIndex]) : undefined} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="SEARCH NAME OR PROFILE ADDRESS" autoComplete="off" /></label>
      <div className="profile-discovery__context" aria-live="polite"><strong>{query ? 'SEARCH RESULTS' : 'PUBLISHED WORLDS'}</strong><span>{displayStatus === 'loading' ? 'SYNCING' : `${results.length.toString().padStart(2, '0')} AVAILABLE`}</span></div>
      <div className="profile-discovery__status" role="status" aria-live="polite">
        {displayStatus === 'loading' && <p>Reading the public INSCAPE registry...</p>}
        {displayStatus === 'ready' && !profiles.length && <p>No published INSCAPE workspaces were found.</p>}
        {displayStatus === 'ready' && profiles.length > 0 && !results.length && <p>No published workspace matches “{query.trim()}”.</p>}
        {displayStatus === 'error' && <div><p>Directory temporarily unavailable. {error}</p><button type="button" onClick={retry}>RETRY</button></div>}
      </div>
      {results.length > 0 && <div id="inscape-directory-results" className="profile-discovery__results" role="listbox" aria-label="Published INSCAPE workspaces">
        {results.map((result, index) => <Result key={result.address} result={result} active={index === activeIndex} optionRef={(node) => { if (node) optionRefs.current.set(result.address, node); else optionRefs.current.delete(result.address); }} onFocus={() => setActiveIndex(index)} onSelect={() => choose(result)} />)}
      </div>}
      <footer><span>LUKSO MAINNET / VERIFIED PUBLICATIONS</span><span>↑↓ NAVIGATE / ENTER VISIT / ESC CLOSE</span></footer>
    </section>
  </div>;
}
