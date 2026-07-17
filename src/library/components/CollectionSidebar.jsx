export default function CollectionSidebar({ workspace, activeView, onOpenView, onCreate, onRename, onDelete }) {
  const askCreate = () => { const name = window.prompt('Folder name', '1/1 Art'); if (name) onCreate(name); };
  const askRename = (folder) => { const name = window.prompt('Rename folder', folder.name); if (name) onRename(folder.id, name); };
  const askDelete = (folder) => { if (window.confirm(`Delete folder “${folder.name}”? Assets will not be affected.`)) onDelete(folder.id); };
  return (
    <aside className="collection-sidebar" aria-label="Collection views">
      <button type="button" data-active={activeView.type === 'all' || undefined} onClick={() => onOpenView({ type: 'all', id: null })}><span>All images</span></button>
      <button type="button" data-active={activeView.type === 'favorites' || undefined} onClick={() => onOpenView({ type: 'favorites', id: null })}><span>Favorites</span><small>{workspace.favorites.length}</small></button>
      <p>Folders</p>
      {workspace.folders.map((folder) => (
        <div className="collection-folder" key={folder.id} data-active={activeView.id === folder.id || undefined}>
          <button type="button" onClick={() => onOpenView({ type: 'folder', id: folder.id })}><span>{folder.name}</span><small>{folder.assetIds.length}</small></button>
          <button type="button" onClick={() => askRename(folder)} aria-label={`Rename ${folder.name}`}>R</button>
          <button type="button" onClick={() => askDelete(folder)} aria-label={`Delete ${folder.name}`}>×</button>
        </div>
      ))}
      <button className="collection-sidebar__new" type="button" onClick={askCreate}>+ New folder</button>
    </aside>
  );
}
