import { useEffect, useRef } from 'react';
import { Archive, FolderTree, Layers3, X } from 'lucide-react';
import BrowserCategoriesPanel from './BrowserCategoriesPanel.jsx';
import BrowserIndexPanel from './BrowserIndexPanel.jsx';
import { BROWSER_TABS } from './browserWorkspaceModel.js';
import useBrowserWorkspace from './useBrowserWorkspace.js';
import useLatticeChromePresence from '../windows/useLatticeChromePresence.js';
import '../rendering/latticeChromePrimitives.css';
import './browserWorkspace.css';

const TABS = Object.freeze([
  { id: BROWSER_TABS.INDEX, label: 'INDEX', Icon: Layers3 },
  { id: BROWSER_TABS.CATEGORIES, label: 'CATEGORIES', Icon: FolderTree },
]);

export default function BrowserWorkspace({ data, onPlaceAsset, onRequestClose, open = false }) {
  const workspace = useBrowserWorkspace(data);
  const presence = useLatticeChromePresence(open ? 'browser' : null);
  const tabRefs = useRef(new Map());

  useEffect(() => {
    if (open) requestAnimationFrame(() => tabRefs.current.get(workspace.activeTab)?.focus({ preventScroll: true }));
  }, [open]);

  if (!presence.renderedValue) return null;

  const handleEscape = (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    onRequestClose?.('escape');
  };
  const selectTab = (tabId, focus = false) => {
    workspace.setActiveTab(tabId);
    if (focus) requestAnimationFrame(() => tabRefs.current.get(tabId)?.focus({ preventScroll: true }));
  };
  const selectedPlacementReason = !workspace.selectedAsset ? 'SELECT ASSET'
    : !workspace.selectedAsset.placeable
      ? workspace.selectedAsset.placementUnavailableReason || 'ASSET UNAVAILABLE'
      : null;
  const placementUnavailableReason = data.activeTable?.placementUnavailableReason || selectedPlacementReason;
  const placementEnabled = Boolean(!placementUnavailableReason && workspace.selectedAsset && onPlaceAsset);
  const placementLabel = placementEnabled
    ? `PLACE PUBLIC / ${data.activeTable?.label || 'ACTIVE TABLE'}`
    : placementUnavailableReason || 'PLACE UNAVAILABLE';
  const handleTabKeyDown = (event, tabId) => {
    const index = TABS.findIndex(({ id }) => id === tabId);
    const destination = event.key === 'ArrowRight' ? TABS[(index + 1) % TABS.length]
      : event.key === 'ArrowLeft' ? TABS[(index - 1 + TABS.length) % TABS.length]
        : event.key === 'Home' ? TABS[0] : event.key === 'End' ? TABS.at(-1) : null;
    if (!destination) return;
    event.preventDefault();
    event.stopPropagation();
    selectTab(destination.id, true);
  };
  return (
    <section
      aria-label="Owner asset Browser"
      className="lattice-browser-workspace"
      data-lattice-chrome
      data-phase={presence.phase}
      aria-hidden={presence.phase === 'exiting' || undefined}
      inert={presence.phase === 'exiting' ? '' : undefined}
      onAnimationEnd={(event) => { if (event.target === event.currentTarget) presence.completeAnimation(); }}
      onKeyDown={handleEscape}
      onPointerDown={(event) => event.stopPropagation()}
      style={{ height: workspace.windowSize.height, width: workspace.windowSize.width }}
    >
      <header className="lattice-browser-header">
        <div><Archive aria-hidden="true" size={15} strokeWidth={2} /><strong>BROWSER</strong><small>{data.fixture ? 'OWNER TOOL / FIXTURE' : 'OWNER TOOL / 01'}</small></div>
        {data.ownerContext && <span>{data.ownerContext}</span>}
        <button aria-label="Close Browser" className="lattice-chrome-close-control" onClick={() => onRequestClose?.('close-control')} type="button"><X aria-hidden="true" size={15} strokeWidth={2} /></button>
      </header>
      <div aria-label="Browser sections" className="lattice-browser-tabs" role="tablist">
        {TABS.map(({ Icon, id, label }) => <button
          aria-controls={`lattice-browser-panel-${id}`}
          aria-selected={workspace.activeTab === id}
          id={`lattice-browser-tab-${id}`}
          key={id}
          onClick={() => selectTab(id)}
          onKeyDown={(event) => handleTabKeyDown(event, id)}
          ref={(node) => { if (node) tabRefs.current.set(id, node); else tabRefs.current.delete(id); }}
          role="tab"
          tabIndex={workspace.activeTab === id ? 0 : -1}
          type="button"
        ><Icon aria-hidden="true" size={14} strokeWidth={2} />{label}</button>)}
      </div>
      <label className="lattice-browser-search">
        <span>SEARCH ASSET POOL</span>
        <input aria-label="Search asset pool" onChange={(event) => workspace.setQuery(event.target.value)} placeholder=" " type="search" value={workspace.query} />
      </label>
      <div
        aria-labelledby={`lattice-browser-tab-${workspace.activeTab}`}
        className="lattice-browser-body"
        id={`lattice-browser-panel-${workspace.activeTab}`}
        role="tabpanel"
      >
        {workspace.activeTab === BROWSER_TABS.INDEX
          ? <BrowserIndexPanel data={data} workspace={workspace} />
          : <BrowserCategoriesPanel data={{ ...data, assets: workspace.categoryAssets }} workspace={workspace} />}
      </div>
      <footer className="lattice-browser-footer">
        <span>{data.fixture ? 'ISOLATED FIXTURE SESSION' : 'ORGANIZATION READ ONLY / PROFILE SCOPED'}</span>
        <span>{workspace.selectedAsset ? workspace.selectedAsset.title || 'ASSET SELECTED' : 'SELECT ASSET'}</span>
        <button
          disabled={!placementEnabled}
          onClick={() => onPlaceAsset?.(workspace.selectedAsset.stableAssetId)}
          type="button"
        >{placementLabel}</button>
      </footer>
      <button
        aria-label="Resize Browser"
        className="lattice-browser-resize"
        onKeyDown={workspace.resize.keyDown}
        onLostPointerCapture={workspace.resize.finish}
        onPointerCancel={workspace.resize.finish}
        onPointerDown={workspace.resize.begin}
        onPointerMove={workspace.resize.update}
        onPointerUp={workspace.resize.finish}
        title="Drag to resize around center; arrow keys resize in steps"
        type="button"
      />
    </section>
  );
}
