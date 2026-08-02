import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import useProfileDiscoveryController from '../../profileDiscovery/useProfileDiscoveryController.js';
import './modul8rPeople.css';

const abbreviate = (address) => address ? `${address.slice(0, 8)}…${address.slice(-6)}` : '';
const initials = (result) => (result.name || 'UP').split(/\s+/u).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
const optionId = (result) => `modul8r-people-${result.address.slice(2)}`;

export default function Modul8rPeopleAdapter({ active, faceplateTargetRef, onVisitProfile, repository }) {
  const {
    activeIndex, error, moveActive, profiles, query, resolveSelection, results, retry, setActiveIndex, setQuery, status,
  } = useProfileDiscoveryController({ active, repository });
  const displayStatus = status === 'idle' && active ? 'loading' : status;
  const [faceplateTarget, setFaceplateTarget] = useState(null);
  const inputRef = useRef(null);
  const optionRefs = useRef(new Map());
  useEffect(() => setFaceplateTarget(faceplateTargetRef?.current || null), [faceplateTargetRef]);

  const select = (profile = null) => {
    const selected = resolveSelection(profile);
    if (selected) onVisitProfile?.(selected.address);
  };
  const handleKeyDown = (event) => {
    if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key)) return;
    if (event.key === 'Enter') {
      if (event.target === inputRef.current && results.length) { event.preventDefault(); select(); }
      return;
    }
    if (!results.length) return;
    event.preventDefault();
    const next = moveActive(event.key === 'ArrowDown' ? 1 : -1);
    if (next && document.activeElement?.classList.contains('modul8r-people__result')) {
      globalThis.requestAnimationFrame?.(() => optionRefs.current.get(next.address)?.focus());
    }
  };
  const search = <label className="modul8r-people__search"><Search aria-hidden="true" size={13} />
    <input aria-activedescendant={results[activeIndex] ? optionId(results[activeIndex]) : undefined}
      aria-autocomplete="list" aria-controls="modul8r-people-results" aria-expanded={results.length > 0}
      aria-label="Search published profiles" onChange={(event) => setQuery(event.target.value)} placeholder="SEARCH"
      ref={inputRef} role="combobox" type="search" value={query} /></label>;

  return <div className="modul8r-people" onKeyDown={handleKeyDown}>
    {active && faceplateTarget && createPortal(search, faceplateTarget)}
    <div className="modul8r-people__context">
      <strong>{query ? 'SEARCH RESULTS' : 'PUBLIC INSCAPE DIRECTORY'}</strong>
      <span>{displayStatus === 'loading' ? 'SYNCING' : `${String(results.length).padStart(2, '0')} AVAILABLE`}</span>
    </div>
    <div aria-live="polite" className="modul8r-people__feedback" role="status">
      {displayStatus === 'loading' && !profiles.length && <p>READING THE PUBLIC INSCAPE REGISTRY</p>}
      {status === 'ready' && !profiles.length && <p>NO PUBLISHED INSCAPE WORKSPACES WERE FOUND</p>}
      {status === 'ready' && profiles.length > 0 && !results.length && <p>NO PUBLISHED WORKSPACE MATCHES “{query.trim()}”</p>}
      {status === 'error' && <p role="alert">DIRECTORY TEMPORARILY UNAVAILABLE / {error} <button onClick={retry} type="button">RETRY</button></p>}
    </div>
    {results.length > 0 && <div aria-label="Published INSCAPE workspaces" className="modul8r-people__results" id="modul8r-people-results" role="listbox">
      {results.map((result, index) => <button aria-selected={index === activeIndex} className="modul8r-people__result"
        id={optionId(result)} key={result.address} onClick={() => select(result)} onFocus={() => setActiveIndex(index)}
        ref={(node) => { if (node) optionRefs.current.set(result.address, node); else optionRefs.current.delete(result.address); }}
        role="option" tabIndex={index === activeIndex ? 0 : -1} type="button">
        <span className="modul8r-people__avatar">{result.avatarUrl ? <img alt="" referrerPolicy="no-referrer" src={result.avatarUrl} /> : <span aria-hidden="true">{initials(result)}</span>}</span>
        <span className="modul8r-people__copy"><strong>{result.name || 'Unnamed profile'}</strong><code title={result.address}>{abbreviate(result.address)}</code><small>PUBLISHED INSCAPE WORKSPACE</small></span>
      </button>)}
    </div>}
  </div>;
}
