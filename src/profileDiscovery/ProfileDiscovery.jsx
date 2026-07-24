import { useEffect, useMemo, useRef, useState } from 'react';
import { luksoProfileDiscoveryRepository } from './data/luksoProfileDiscoveryRepository.js';
import './inscapeDirectory.css';

const abbreviate = (address) => address ? `${address.slice(0, 8)}…${address.slice(-6)}` : '';
const initials = (result) => (result.name || 'UP').split(/\s+/u).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const searchable = (result) => `${result.name || ''} ${result.address}`.toLowerCase();
function optionId(result) { return `inscape-directory-${result.address.slice(2)}`; }
function Result({ result, active, onFocus, onSelect, optionRef }) {
  return <button ref={optionRef} id={optionId(result)} type="button" role="option" aria-selected={active} tabIndex={active ? 0 : -1}
    className="profile-discovery__result" onFocus={onFocus} onClick={onSelect}>
    <span className="profile-discovery__avatar">{result.avatarUrl ? <img src={result.avatarUrl} alt="" referrerPolicy="no-referrer" /> : <span aria-hidden="true">{initials(result)}</span>}</span>
    <span className="profile-discovery__result-copy"><strong>{result.name || 'Unnamed profile'}</strong>
      <code title={result.address}>{abbreviate(result.address)}</code><small>Published INSCAPE workspace</small></span>
  </button>;
}

export default function ProfileDiscovery({ onClose, onSelect, repository = luksoProfileDiscoveryRepository }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ status: 'loading', profiles: [], error: null });
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null); const dialogRef = useRef(null);
  const optionRefs = useRef(new Map());
  const cleanupRef = useRef(() => {}); const previousFocusRef = useRef(document.activeElement);
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? state.profiles.filter((profile) => searchable(profile).includes(normalized)) : state.profiles;
  }, [query, state.profiles]);
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
  const load = () => {
    cleanupRef.current();
    const controller = new AbortController();
    setState((current) => ({ ...current, status: 'loading', error: null }));
    repository.list({ signal: controller.signal }).then((profiles) => {
      if (!controller.signal.aborted) setState({ status: 'ready', profiles, error: null });
    }).catch((error) => {
      if (!controller.signal.aborted && error?.name !== 'AbortError') setState({ status: 'error', profiles: [],
        error: error instanceof Error ? error.message : String(error) });
    });
    cleanupRef.current = () => controller.abort();
  };
  useEffect(() => { load(); return () => cleanupRef.current(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setActiveIndex(0); }, [query, state.profiles]);
  const choose = (result = results[activeIndex]) => { if (result) onSelect(result); };
  const moveActive = (offset) => {
    setActiveIndex((current) => {
      const next = (current + offset + results.length) % results.length;
      if (document.activeElement?.classList.contains('profile-discovery__result')) {
        globalThis.requestAnimationFrame?.(() => optionRefs.current.get(results[next]?.address)?.focus());
      }
      return next;
    });
  };
  const onKeyDown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
    if (event.key === 'ArrowDown' && results.length) { event.preventDefault(); moveActive(1); }
    if (event.key === 'ArrowUp' && results.length) { event.preventDefault(); moveActive(-1); }
    if (event.key === 'Enter' && results.length && event.target === inputRef.current) { event.preventDefault(); choose(); }
    if (event.key === 'Tab') { const focusable = [...dialogRef.current.querySelectorAll('input,button:not(:disabled)')]; if (!focusable.length) return;
      const edge = event.shiftKey ? focusable[0] : focusable.at(-1); if (document.activeElement === edge) { event.preventDefault(); (event.shiftKey ? focusable.at(-1) : focusable[0]).focus(); } }
  };
  return <div className="profile-discovery" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="profile-discovery__panel" role="dialog" aria-modal="true" aria-labelledby="profile-discovery-title" onKeyDown={onKeyDown}>
      <header><div><p>INSCAPE / PUBLIC DIRECTORY</p><h2 id="profile-discovery-title">Explore worlds</h2></div><button type="button" onClick={onClose} aria-label="Close INSCAPE directory">×</button></header>
      <label className="profile-discovery__search"><span className="sr-only">Search published workspaces</span><input ref={inputRef} type="search" role="combobox" aria-autocomplete="list" aria-expanded={results.length > 0} aria-controls="inscape-directory-results" aria-activedescendant={results[activeIndex] ? optionId(results[activeIndex]) : undefined} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="SEARCH NAME OR PROFILE ADDRESS" autoComplete="off" /></label>
      <div className="profile-discovery__context" aria-live="polite"><strong>{query ? 'SEARCH RESULTS' : 'PUBLISHED WORLDS'}</strong><span>{state.status === 'loading' ? 'SYNCING' : `${results.length.toString().padStart(2, '0')} AVAILABLE`}</span></div>
      <div className="profile-discovery__status" role="status" aria-live="polite">
        {state.status === 'loading' && <p>Reading the public INSCAPE registry...</p>}
        {state.status === 'ready' && !state.profiles.length && <p>No published INSCAPE workspaces were found.</p>}
        {state.status === 'ready' && state.profiles.length > 0 && !results.length && <p>No published workspace matches “{query.trim()}”.</p>}
        {state.status === 'error' && <div><p>Directory temporarily unavailable. {state.error}</p><button type="button" onClick={load}>RETRY</button></div>}
      </div>
      {results.length > 0 && <div id="inscape-directory-results" className="profile-discovery__results" role="listbox" aria-label="Published INSCAPE workspaces">
        {results.map((result, index) => <Result key={result.address} result={result} active={index === activeIndex} optionRef={(node) => { if (node) optionRefs.current.set(result.address, node); else optionRefs.current.delete(result.address); }} onFocus={() => setActiveIndex(index)} onSelect={() => choose(result)} />)}
      </div>}
      <footer><span>LUKSO MAINNET / VERIFIED PUBLICATIONS</span><span>↑↓ NAVIGATE / ENTER VISIT / ESC CLOSE</span></footer>
    </section>
  </div>;
}
