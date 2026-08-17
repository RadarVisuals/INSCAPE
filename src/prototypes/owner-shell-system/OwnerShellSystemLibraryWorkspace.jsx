import { useMemo } from 'react';
import Modul8rLibraryAdapter from '../../lattice/modul8r/Modul8rLibraryAdapter.jsx';
import { BROWSER_SORTS } from '../../lattice/browser/browserWorkspaceModel.js';
import { OwnerShellSystemWorkspaceRail } from './OwnerShellSystemControls.jsx';

const LIBRARY_SORT_OPTIONS = Object.freeze([
  { label: 'TITLE / A–Z', value: BROWSER_SORTS.TITLE_ASC },
  { label: 'TITLE / Z–A', value: BROWSER_SORTS.TITLE_DESC },
  { label: 'COLLECTION', value: BROWSER_SORTS.COLLECTION },
]);

function LibraryRail({ menuSurface, onClose, workspace }) {
  const collectionOptions = useMemo(() => workspace.collections
    .map((collection) => ({ label: collection, value: collection })), [workspace.collections]);

  return <OwnerShellSystemWorkspaceRail
    filterMenu={{
      accessibleLabel: 'NFT collection filters',
      active: workspace.collection !== 'all',
      onChange: workspace.setCollection,
      onReset: () => workspace.setCollection('all'),
      options: collectionOptions,
      value: workspace.collection,
    }}
    labelsVisible={!workspace.hideLabels}
    menuSurface={menuSurface}
    onClose={onClose}
    onLabelsVisibleChange={(visible) => workspace.setHideLabels(!visible)}
    onQueryChange={workspace.setQuery}
    onSizeChange={workspace.setAssetSize}
    query={workspace.query}
    secondaryMenu={{
      label: 'SORT',
      onChange: workspace.setSort,
      options: LIBRARY_SORT_OPTIONS,
      triggerPrefix: 'SORT',
      value: workspace.sort,
    }}
    size={workspace.assetSize}
    sizeBounds={{ maximum: workspace.assetSizeBounds.MAXIMUM, minimum: workspace.assetSizeBounds.MINIMUM }}
  />;
}

export default function OwnerShellSystemLibraryWorkspace({
  categoryCommands,
  data,
  menuSurface,
  onAssetPointerDown,
  onClose,
  phase,
  placing,
  sidebarCollapsed,
  sidebarWidth,
  workspace,
}) {
  return <section aria-hidden={phase === 'closing' || undefined} aria-label="Library workspace"
    className="owner-shell-system__workspace-window owner-shell-system__library owner-shell-system__motion-panel"
    data-panel-phase={phase} data-placing={placing || undefined} data-sidebar-collapsed={sidebarCollapsed || undefined}
    inert={phase === 'closing' ? '' : undefined} style={{ '--prototype-sidebar-width': `${sidebarWidth}px` }}>
    <Modul8rLibraryAdapter categoryCommands={categoryCommands} data={data}
      onAssetPointerDown={onAssetPointerDown} workspace={workspace} />
    <footer className="owner-shell-system__local-rail">
      <LibraryRail menuSurface={menuSurface} onClose={onClose} workspace={workspace} />
    </footer>
  </section>;
}
