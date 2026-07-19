export default function CollectionSidebar({ workspace, activeView, onOpenView, onCreate, onRename, onDelete, canAuthorLibrary = false }) {
  const askDelete = (folder) => { if (window.confirm(`Delete folder “${folder.name}”? Assets will not be affected.`)) onDelete(folder.id); };
  return (
    <aside className="collection-sidebar" aria-label="Library views">
      <button type="button" data-active={activeView.type === 'all' || undefined} onClick={() => onOpenView({ type: 'all', id: null })}><span>All images</span></button>
      <button type="button" data-active={activeView.type === 'favorites' || undefined} onClick={() => onOpenView({ type: 'favorites', id: null })}><span>Favorites</span><small>{workspace.favorites.length}</small></button>
      <p>Folders</p>
      {workspace.folders.map((folder) => (
        <div className="collection-folder" key={folder.id} data-active={activeView.id === folder.id || undefined} data-edit-mode={canAuthorLibrary || undefined}>
          <button type="button" title={folder.name} onClick={() => onOpenView({ type: 'folder', id: folder.id })}><span>{folder.name}</span><small>{folder.assetIds.length}</small></button>
          {canAuthorLibrary && <button type="button" title="Rename folder" onClick={() => onRename(folder)} aria-label={`Rename ${folder.name}`}>R</button>}
          {canAuthorLibrary && <button type="button" onClick={() => askDelete(folder)} aria-label={`Delete ${folder.name}`}>×</button>}
        </div>
      ))}
      {canAuthorLibrary && <button className="collection-sidebar__new" type="button" onClick={onCreate}>+ New folder</button>}
    </aside>
  );
}
