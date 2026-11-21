import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Plus, Search } from 'lucide-react';
import { OwnerSystemWorkflowFilterMenu, OwnerSystemWorkflowSelectMenu } from './OwnerSystemWorkflowWorkspaceControls.jsx';
import RackMenu from '../menus/RackMenu.jsx';

// Display preferences stay local to the Library; creation uses its existing commands.
export default function LibraryBrowseControls({ workspace, onCreate, canCreateFolder, canCreateSection }) {
  const [menu, setMenu] = useState(null);
  const root = useRef(null), newButton = useRef(null), viewButton = useRef(null), display = useRef(null);
  const close = (focus = false) => { const button = menu?.kind === 'new' ? newButton.current : viewButton.current; setMenu(null); if (focus) button?.focus(); };
  useEffect(() => {
    if (menu?.kind !== 'view') return;
    display.current?.querySelector('[aria-pressed="true"]')?.focus();
    const dismiss = event => { if (!root.current?.contains(event.target)) setMenu(null); };
    document.addEventListener('pointerdown', dismiss, true);
    return () => document.removeEventListener('pointerdown', dismiss, true);
  }, [menu?.kind]);
  const collections = [{ label: 'All', value: 'all' }, ...workspace.collections.map(value => ({ label: value, value }))];
  const sorts = [{ label: 'A–Z', value: 'title-asc' }, { label: 'Z–A', value: 'title-desc' }, { label: 'Collection', value: 'collection' }];
  return <div className="library-browse-controls" ref={root} onKeyDown={event => {
    if (event.key === 'Escape' && menu) { event.preventDefault(); event.stopPropagation(); close(true); }
  }}>
    <label className="system-workflow__workspace-search"><Search size={14} aria-hidden="true" />
      <input type="search" aria-label="Search" placeholder="Search assets" value={workspace.query} onChange={event => workspace.setQuery(event.target.value)} /></label>
    <div className="library-browse-actions">
      <button type="button" ref={newButton} aria-label="New Library item" aria-haspopup="menu" aria-expanded={menu?.kind === 'new'}
        disabled={!canCreateFolder && !canCreateSection} onClick={() => {
          const rect = newButton.current.getBoundingClientRect();
          setMenu(menu?.kind === 'new' ? null : { kind: 'new', anchor: { x: rect.left, y: rect.bottom + 4 } });
        }}><Plus size={14} aria-hidden="true" /><span>New</span></button>
      <OwnerSystemWorkflowFilterMenu flat palette="editor" onChange={workspace.setCollection} options={collections} value={workspace.collection} />
        <OwnerSystemWorkflowSelectMenu flat compact palette="editor" label="Sort assets" onChange={workspace.setSort} options={sorts} value={workspace.sort} />
      <button type="button" ref={viewButton} aria-label="Library display options" aria-haspopup="dialog" aria-expanded={menu?.kind === 'view'}
        onClick={() => setMenu(menu?.kind === 'view' ? null : { kind: 'view' })}><span>View</span><ChevronDown size={12} aria-hidden="true" /></button>
    </div>
    {menu?.kind === 'view' && <div className="library-display-options" role="dialog" aria-label="Library display options" ref={display}>
      <span>Navigation</span><div className="library-navigation-modes" role="group" aria-label="Navigation style">
        {['icons', 'names'].map(mode => <button key={mode} type="button" aria-pressed={workspace.navigationMode === mode}
          onClick={() => workspace.setNavigationMode(mode)}>{mode === 'icons' ? 'Icons' : 'Names'}</button>)}
      </div>
      <label className="system-workflow__workspace-labels"><input type="checkbox" checked={!workspace.hideLabels} onChange={event => workspace.setHideLabels(!event.target.checked)} /><span>Labels</span></label>
      <label className="library-thumbnail-size"><span>Size <output>{workspace.assetSize} px</output></span><input aria-label="Card size" type="range"
        min={workspace.assetSizeBounds.MINIMUM} max={workspace.assetSizeBounds.MAXIMUM} value={workspace.assetSize}
        onChange={event => workspace.setAssetSize(Number(event.target.value))} /></label>
    </div>}
    {menu?.kind === 'new' && createPortal(<RackMenu label="New Library item" palette="editor" anchor={menu.anchor} returnFocus={newButton.current}
      commands={[{ id: 'category', label: 'Folder', disabled: !canCreateFolder }, { id: 'section', label: 'Section', disabled: !canCreateSection }]}
      onClose={() => setMenu(null)} onCommand={kind => { setMenu(null); onCreate({ currentTarget: newButton.current }, kind); }} />, document.body)}
  </div>;
}
