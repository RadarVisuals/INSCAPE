import { useEffect, useState } from 'react';

export default function OwnerFolderRack({ folders, onCreate, onRename, onVisibilityChange, onClose }) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    if (editingId && !folders.some((folder) => folder.id === editingId)) {
      setEditingId(null);
      setEditingName('');
    }
  }, [editingId, folders]);

  const create = (event) => {
    event.preventDefault();
    if (!newName.trim()) return;
    onCreate(newName);
    setNewName('');
  };
  const rename = (event) => {
    event.preventDefault();
    if (!editingId || !editingName.trim()) return;
    onRename(editingId, editingName);
    setEditingId(null);
    setEditingName('');
  };

  const publicCount = folders.filter((folder) => folder.visitorVisible).length;
  return <aside className="profile-document-panel" role="dialog" aria-modal="false" aria-labelledby="owner-folder-rack-title" onPointerDown={(event) => event.stopPropagation()}>
    <header><div><span>Owner rack</span><h2 id="owner-folder-rack-title">Folders / Spaces</h2></div><button type="button" onClick={onClose} aria-label="Close folders">×</button></header>
    <div className="profile-document-panel__status"><span>{folders.length} folders</span><span>{publicCount} public</span><span>{folders.length - publicCount} private</span></div>
    <p>Private folders stay in your saved draft. Public spaces appear in Preview and can be included in your next publication.</p>
    <form className="profile-document-panel__publication" onSubmit={create}>
      <h3>Create folder</h3>
      <label htmlFor="owner-folder-new-name">Folder name</label>
      <input id="owner-folder-new-name" value={newName} maxLength={80} onChange={(event) => setNewName(event.target.value)} />
      <button type="submit" disabled={!newName.trim()}>Create private folder</button>
    </form>
    {folders.map((folder) => <section className="profile-document-panel__publication" key={folder.id} aria-label={`Folder: ${folder.name}`}>
      {editingId === folder.id ? <form onSubmit={rename}>
        <label htmlFor={`owner-folder-name-${folder.id}`}>Folder name</label>
        <input id={`owner-folder-name-${folder.id}`} value={editingName} maxLength={80} autoFocus onChange={(event) => setEditingName(event.target.value)} />
        <div className="profile-document-panel__actions"><button type="submit" disabled={!editingName.trim()}>Save name</button><button type="button" onClick={() => setEditingId(null)}>Cancel</button></div>
      </form> : <><h3>{folder.name}</h3><p>{folder.assetCount} {folder.assetCount === 1 ? 'asset' : 'assets'} · {folder.visitorVisible ? 'PUBLIC SPACE' : 'PRIVATE FOLDER'}</p><div className="profile-document-panel__actions"><button type="button" onClick={() => { setEditingId(folder.id); setEditingName(folder.name); }}>Rename</button><button type="button" aria-pressed={folder.visitorVisible} onClick={() => onVisibilityChange(folder.id, !folder.visitorVisible)}>{folder.visitorVisible ? 'Make private' : 'Make public'}</button></div></>}
    </section>)}
  </aside>;
}
