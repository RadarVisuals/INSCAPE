import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeProfileAddress } from '../library/config.js';
import { luksoProfileDiscoveryRepository } from './data/luksoProfileDiscoveryRepository.js';
import './profileDiscovery.css';

const abbreviate = (address) => address ? `${address.slice(0, 8)}…${address.slice(-6)}` : '';
const initials = (result) => (result.name || 'UP').split(/\s+/u).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
function Result({ result, active, onFocus, onSelect }) {
  const factualStatus = result.status === 'INDEXED' ? 'Indexed Universal Profile'
    : result.isUniversalProfile ? (result.name ? 'LSP3 profile verified' : 'Universal Profile · metadata unavailable')
      : result.status === 'ERROR' ? 'Address lookup unavailable' : 'Address is not a Universal Profile';
  return <button type="button" role="option" aria-selected={active} tabIndex={active ? 0 : -1}
    className="profile-discovery__result" onFocus={onFocus} onClick={onSelect} disabled={!result.isUniversalProfile}>
    <span className="profile-discovery__avatar">{result.avatarUrl ? <img src={result.avatarUrl} alt="" /> : <span aria-hidden="true">{initials(result)}</span>}</span>
    <span className="profile-discovery__result-copy"><strong>{result.name || 'Unnamed profile'}</strong>
      <code title={result.address}>{abbreviate(result.address)}</code><small>{factualStatus} · {result.source}</small></span>
  </button>;
}

export default function ProfileDiscovery({ onClose, onSelect, repository = luksoProfileDiscoveryRepository }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ status: 'idle', results: [], error: null });
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null); const dialogRef = useRef(null); const requestRef = useRef(0);
  const cleanupRef = useRef(() => {}); const previousFocusRef = useRef(document.activeElement);
  const exactAddress = useMemo(() => normalizeProfileAddress(query), [query]);
  useEffect(() => { inputRef.current?.focus(); return () => previousFocusRef.current?.focus?.(); }, []);
  const runSearch = (value, { immediate = false } = {}) => {
    cleanupRef.current(); const trimmed = value.trim(); const requestId = ++requestRef.current;
    if (!trimmed) { setState({ status: 'idle', results: [], error: null }); cleanupRef.current = () => {}; return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState((current) => ({ ...current, status: 'loading', error: null }));
      try { const results = await repository.search(trimmed, { signal: controller.signal });
        if (controller.signal.aborted || requestRef.current !== requestId) return;
        setActiveIndex(0); setState({ status: results.length ? 'ready' : 'empty', results, error: null });
      } catch (error) { if (controller.signal.aborted || requestRef.current !== requestId || error?.name === 'AbortError') return;
        setState({ status: 'error', results: [], error: error instanceof Error ? error.message : String(error) }); }
    }, immediate ? 0 : 320);
    cleanupRef.current = () => { window.clearTimeout(timer); controller.abort(); };
  };
  useEffect(() => { runSearch(query, { immediate: Boolean(exactAddress) }); return () => cleanupRef.current(); }, [query]); // eslint-disable-line react-hooks/exhaustive-deps
  const retry = () => runSearch(query, { immediate: true });
  const choose = (result = state.results[activeIndex]) => { if (result?.isUniversalProfile) onSelect(result); };
  const onKeyDown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
    if (event.key === 'ArrowDown' && state.results.length) { event.preventDefault(); setActiveIndex((value) => (value + 1) % state.results.length); }
    if (event.key === 'ArrowUp' && state.results.length) { event.preventDefault(); setActiveIndex((value) => (value - 1 + state.results.length) % state.results.length); }
    if (event.key === 'Enter' && state.results.length) { event.preventDefault(); choose(); }
    if (event.key === 'Tab') { const focusable = [...dialogRef.current.querySelectorAll('input,button:not(:disabled)')]; if (!focusable.length) return;
      const edge = event.shiftKey ? focusable[0] : focusable.at(-1); if (document.activeElement === edge) { event.preventDefault(); (event.shiftKey ? focusable.at(-1) : focusable[0]).focus(); } }
  };
  return <div className="profile-discovery" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className="profile-discovery__panel" role="dialog" aria-modal="true" aria-labelledby="profile-discovery-title" onKeyDown={onKeyDown}>
      <header><div><p>Universal Profile discovery</p><h2 id="profile-discovery-title">Find another profile</h2></div><button type="button" onClick={onClose} aria-label="Close profile discovery">×</button></header>
      <label className="profile-discovery__search"><span>Name or address</span><input ref={inputRef} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a name or paste 0x address…" autoComplete="off" /></label>
      <div className="profile-discovery__status" role="status" aria-live="polite">
        {state.status === 'idle' && <p>Names come from the LUKSO indexer. Addresses are verified directly on LUKSO mainnet.</p>}
        {state.status === 'loading' && <p>Searching profiles…</p>}
        {state.status === 'empty' && <p>No indexed profiles match “{query.trim()}”. Try an exact profile address.</p>}
        {state.status === 'error' && <div><p>Profile discovery is unavailable. {state.error}</p><button type="button" onClick={retry}>[ Retry ]</button></div>}
      </div>
      {state.results.length > 0 && <div className="profile-discovery__results" role="listbox" aria-label="Universal Profile results">
        {state.results.map((result, index) => <Result key={result.address} result={result} active={index === activeIndex} onFocus={() => setActiveIndex(index)} onSelect={() => choose(result)} />)}
      </div>}
      <footer><span>LUKSO MAINNET · READ-ONLY</span><span>↑↓ Navigate · Enter Visit · Esc Close</span></footer>
    </section>
  </div>;
}
