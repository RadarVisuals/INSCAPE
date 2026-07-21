import { useEffect, useRef, useState } from 'react';
import { ownerInventoryFolderCommands } from './ownerInventoryMenu.js';
import './ownerInventoryRack.css';

function CollapseAllIcon() {
  return <svg className="published-rack-master-control__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5h10M5 2l3 3 3-3M3 11h10M5 14l3-3 3 3" /></svg>;
}

function NewFolderIcon() {
  return <svg className="published-rack-master-control__icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h5l2 2h5v7H2zM8 7v5M5.5 9.5h5" /></svg>;
}

function MoreIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3" cy="8" r="1" /><circle cx="8" cy="8" r="1" /><circle cx="13" cy="8" r="1" /></svg>;
}

function reconcileOrder(current, folders) {
  const incoming = folders.map(({ id }) => id);
  const available = new Set(incoming);
  const retained = current.filter((id) => available.has(id));
  const retainedIds = new Set(retained);
  const next = [...retained, ...incoming.filter((id) => !retainedIds.has(id))];
  return next.length === current.length && next.every((id, index) => id === current[index]) ? current : next;
}

export default function OwnerInventoryRack({ folders, assets, assetStatus, assetError, AssetPicker, Menu, onCreate, onDelete, onRequestAssets, onRename, onVisibilityChange, onSetFolderAsset }) {
  const [order, setOrder] = useState(() => folders.map(({ id }) => id));
  const [openIds, setOpenIds] = useState(() => new Set());
  const [pickerFolderId, setPickerFolderId] = useState(null);
  const [modalReturnFocus, setModalReturnFocus] = useState(null);
  const [menu, setMenu] = useState(null);
  const [rename, setRename] = useState(null);
  const [create, setCreate] = useState(null);
  const newFolderButtonRef = useRef(null);

  useEffect(() => setOrder((current) => reconcileOrder(current, folders)), [folders]);
  useEffect(() => setOpenIds((current) => {
    const available = new Set(folders.map(({ id }) => id));
    const next = new Set([...current].filter((id) => available.has(id)));
    return next.size === current.size && [...next].every((id) => current.has(id)) ? current : next;
  }), [folders]);
  useEffect(() => {
    if (pickerFolderId && !folders.some(({ id }) => id === pickerFolderId)) setPickerFolderId(null);
  }, [folders, pickerFolderId]);
  useEffect(() => {
    if (menu && !folders.some(({ id }) => id === menu.folderId)) setMenu(null);
    if (rename && !folders.some(({ id }) => id === rename.folderId)) setRename(null);
  }, [folders, menu, rename]);
  useEffect(() => {
    if (!rename) return undefined;
    const close = (event) => { if (event.key === 'Escape') { event.preventDefault(); const target = rename.returnFocus; setRename(null); window.requestAnimationFrame(() => target?.focus?.()); } };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [rename]);
  useEffect(() => {
    if (!create) return undefined;
    const close = (event) => { if (event.key === 'Escape') { event.preventDefault(); const target = create.returnFocus; setCreate(null); window.requestAnimationFrame(() => target?.focus?.()); } };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [create]);
  useEffect(() => {
    if (!pickerFolderId) return undefined;
    const close = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      const target = modalReturnFocus;
      setPickerFolderId(null);
      setModalReturnFocus(null);
      window.requestAnimationFrame(() => target?.focus?.());
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [modalReturnFocus, pickerFolderId]);

  const toggle = (id) => setOpenIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const openPicker = (folderId, returnFocus = null) => {
    onRequestAssets();
    setModalReturnFocus(returnFocus);
    setPickerFolderId(folderId);
  };
  const closePicker = () => {
    const target = modalReturnFocus;
    setPickerFolderId(null);
    setModalReturnFocus(null);
    window.requestAnimationFrame(() => target?.focus?.());
  };
  const saveMembership = (folder, selectedIds) => {
    const currentIds = new Set(folder.assetIds);
    const candidateIds = new Set([...folder.assetIds, ...assets.map((asset) => asset.id)]);
    candidateIds.forEach((assetId) => {
      const included = selectedIds.has(assetId);
      if (currentIds.has(assetId) !== included) onSetFolderAsset(folder.id, assetId, included);
    });
    closePicker();
  };
  const pickerFolder = folders.find(({ id }) => id === pickerFolderId) || null;
  const menuFolder = folders.find(({ id }) => id === menu?.folderId) || null;
  const openMenu = (folderId, anchor, returnFocus) => setMenu({ folderId, anchor, returnFocus });
  const openPointerMenu = (event, folderId) => {
    event.preventDefault();
    event.stopPropagation();
    const returnFocus = event.target.closest?.('button') || event.currentTarget.querySelector('button');
    openMenu(folderId, { x: event.clientX, y: event.clientY }, returnFocus);
  };
  const openKeyboardMenu = (event, folderId) => {
    if (!(event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey))) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    openMenu(folderId, { x: rect.right - 8, y: rect.bottom }, event.target.closest?.('button') || event.currentTarget.querySelector('button'));
  };
  const openButtonMenu = (event, folderId) => {
    const rect = event.currentTarget.getBoundingClientRect();
    openMenu(folderId, { x: rect.right, y: rect.bottom }, event.currentTarget);
  };
  const runMenuCommand = (command) => {
    if (!menuFolder) return;
    const folder = menuFolder;
    const returnFocus = menu.returnFocus;
    setMenu(null);
    if (command === 'manage-assets') openPicker(folder.id, returnFocus);
    else if (command === 'rename') setRename({ folderId: folder.id, name: folder.name, returnFocus });
    else if (command === 'toggle-visibility') { onVisibilityChange(folder.id, !folder.visitorVisible); window.requestAnimationFrame(() => returnFocus?.focus?.()); }
    else if (command === 'new-folder') openCreate(returnFocus);
    else if (command === 'delete-folder' && window.confirm(`Delete folder “${folder.name}”? Its assets will remain in your Library.`)) {
      onDelete(folder.id);
      window.requestAnimationFrame(() => newFolderButtonRef.current?.focus?.());
    }
  };
  const closeRename = () => {
    const target = rename?.returnFocus;
    setRename(null);
    window.requestAnimationFrame(() => target?.focus?.());
  };
  const openCreate = (returnFocus = newFolderButtonRef.current) => setCreate({ name: '', returnFocus });
  const closeCreate = () => {
    const target = create?.returnFocus;
    setCreate(null);
    window.requestAnimationFrame(() => target?.focus?.());
  };

  return <aside className="published-inventory-rack" aria-label="Owner inventory rack" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
    <header className="published-inventory-rack__master">
      <div className="published-inventory-rack__mark" aria-hidden="true"><img src="/assets/logo/underneath_os.svg" alt="" draggable="false" /></div>
      <div className="published-inventory-rack__brand"><strong>INVENTORY</strong><small>OWNER WORKSPACE</small></div>
      <button className="published-rack-master-control" type="button" aria-label="Collapse all owner folders" onClick={() => setOpenIds(new Set())}><CollapseAllIcon /><span>COLLAPSE ALL</span></button>
      <button ref={newFolderButtonRef} className="published-rack-master-control" type="button" aria-label="Create new folder" onClick={(event) => openCreate(event.currentTarget)}><NewFolderIcon /><span>NEW FOLDER</span></button>
    </header>
    <div className="published-inventory-rack__list">
      {order.map((id) => {
        const folder = folders.find((candidate) => candidate.id === id);
        if (!folder) return null;
        const open = openIds.has(id);
        const contentId = `owner-folder-${id}`;
        return <section className="published-rack-module" data-rack-module={id} data-open={open || undefined} data-visibility={folder.visitorVisible ? 'public' : 'private'} key={id}>
          <div className="published-rack-module__bar" onContextMenu={(event) => openPointerMenu(event, folder.id)} onKeyDown={(event) => openKeyboardMenu(event, folder.id)}>
            <button className="published-rack-module__name" type="button" aria-expanded={open} aria-controls={contentId} onClick={() => toggle(id)}><strong>{folder.name}</strong><small>{folder.visitorVisible ? 'PUBLIC' : 'PRIVATE'} · {folder.assetCount}</small></button>
            <button className="published-rack-module__copy owner-inventory-rack__more" type="button" aria-haspopup="menu" aria-expanded={menu?.folderId === folder.id} aria-label={`Manage ${folder.name}`} onClick={(event) => openButtonMenu(event, folder.id)}><MoreIcon /></button>
            <button className="published-rack-module__signal-control" type="button" aria-expanded={open} aria-controls={contentId} aria-label={`${open ? 'Collapse' : 'Expand'} ${folder.name}`} onClick={() => toggle(id)}><span className="published-rack-module__signal" aria-hidden="true" /></button>
          </div>
          <div className="published-rack-module__body owner-inventory-rack__body" id={contentId} hidden={!open}><strong>{folder.visitorVisible ? 'PUBLIC SPACE' : 'PRIVATE FOLDER'}</strong><p>{folder.assetCount} {folder.assetCount === 1 ? 'asset' : 'assets'}. {folder.visitorVisible ? 'Included in the current public Preview.' : 'Visible only in your owner workspace.'}</p></div>
        </section>;
      })}
      {!folders.length && <p>No folders yet. Use New Folder to create your first private folder.</p>}
    </div>
    {menuFolder && <Menu anchor={menu.anchor} commands={ownerInventoryFolderCommands(menuFolder)} label={`Manage ${menuFolder.name}`} returnFocus={menu.returnFocus} onClose={() => setMenu(null)} onCommand={runMenuCommand} />}
    {pickerFolder && <AssetPicker assets={assets} folder={pickerFolder} emptyMessage={assetStatus === 'loading' ? 'Loading Library assets…' : assetError ? 'Library assets are currently unavailable.' : 'No Library assets are available.'} onCancel={closePicker} onSave={(selectedIds) => saveMembership(pickerFolder, selectedIds)} />}
    {rename && <div className="collection-folder-dialog" role="dialog" aria-modal="true" aria-labelledby="owner-folder-rename-title"><form onSubmit={(event) => { event.preventDefault(); if (!rename.name.trim()) return; onRename(rename.folderId, rename.name); closeRename(); }}><span>Owner Inventory / Folder</span><h3 id="owner-folder-rename-title">Rename folder</h3><label htmlFor="owner-inventory-folder-name">Folder name</label><input id="owner-inventory-folder-name" autoFocus value={rename.name} maxLength={80} onChange={(event) => setRename((current) => ({ ...current, name: event.target.value }))} /><div><button type="button" onClick={closeRename}>Cancel</button><button type="submit" disabled={!rename.name.trim()}>Save name</button></div></form></div>}
    {create && <div className="collection-folder-dialog" role="dialog" aria-modal="true" aria-labelledby="owner-folder-create-title"><form onSubmit={(event) => { event.preventDefault(); if (!create.name.trim()) return; onCreate(create.name); closeCreate(); }}><span>Owner Inventory / Folder</span><h3 id="owner-folder-create-title">New folder</h3><label htmlFor="owner-inventory-new-folder-name">Folder name</label><input id="owner-inventory-new-folder-name" autoFocus value={create.name} maxLength={80} onChange={(event) => setCreate((current) => ({ ...current, name: event.target.value }))} /><div><button type="button" onClick={closeCreate}>Cancel</button><button type="submit" disabled={!create.name.trim()}>Create private folder</button></div></form></div>}
  </aside>;
}
