import { ArrowLeft, ChevronDown, ChevronRight, Folder, FolderPlus, Images, Layers3 } from 'lucide-react';
import { isValidElement, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BROWSER_ASSET_SIZE, BROWSER_VIEW_KINDS, categoryMembershipState } from '../../lattice/browser/browserWorkspaceModel.js';
import SourceCardGrid from '../../library/SourceCardGrid.jsx';
import LibraryBrowseControls from './LibraryBrowseControls.jsx';
import RackMenu from '../menus/RackMenu.jsx';
import { clearOwnerSystemWorkflowDocumentSelection } from './ownerSystemWorkflowSelection.js';
import { CurationMark, ImageChoice, libraryCategoryImage, libraryImageChoices, librarySourceLabel } from './OwnerSystemWorkflowLibraryImages.jsx';
import LibraryArtworkImage from './LibraryArtworkImage.jsx';
import { resolvePublishedAssetUrl } from '../../profileDocument/domain/publishedAssetUrl.js';
import { libraryFileFormat, libraryFilename, libraryPreviewUrl, rememberArtworkPreview } from '../../library/data/libraryImagePreview.js';
import { OwnerSystemWorkflowSidebarDeleteConfirmation, OwnerSystemWorkflowSidebarEditor } from './OwnerSystemWorkflowBrowserWorkspace.jsx';
import useDeferredFocusReturn from '../useDeferredFocusReturn.js';

const assetId = (asset) => asset?.stableAssetId || asset?.id;

function LazyLibraryArtwork({ asset, id, workspace }) {
  const candidates = [...new Set([asset.previewSrc, ...(asset.previewCandidates || [])].filter(Boolean))];
  const signature = candidates.join('\n');
  const [candidateIndex, setCandidateIndex] = useState(0);
  useEffect(() => setCandidateIndex(0), [signature]);
  const source = candidates[candidateIndex] || null;
  if (!source && (workspace.curationRole === 'destination' || workspace.curatedPicker)) return <span className="curation-fallback" title={id}>
    <strong>{asset.title || id}</strong>{asset.folderContext && <small>{asset.folderContext}</small>}
  </span>;
  if (!source) return <span>Media unavailable</span>;
  return <LibraryArtworkImage key={source} fileType={asset.mediaFileType || asset.assetRecord?.mediaFileType}
    alt="" aria-hidden="true" className="lattice-browser-asset__decoded-image"
    decoding="async" draggable="false" loading="lazy" onError={() => {
      if (candidateIndex + 1 < candidates.length) setCandidateIndex(candidateIndex + 1);
      else { setCandidateIndex(candidates.length); workspace.markAssetUnavailable(id); }
    }} onLoad={(event) => {
      const { naturalHeight: height, naturalWidth: width } = event.currentTarget;
      if (!width || !height) return;
      workspace.markAssetReady(id, source, width, height);
      rememberArtworkPreview(asset.src, source, width, height);
    }} src={source} />;
}

function LibraryNavigationButton({ active, categoryId, count, draggable = false, dropTarget, icon: Icon = Folder,
  label, onClick, onContextMenu, onDragEnd, onDragStart, unresolved = 0, showTooltip = true }) {
  return <button aria-label={label} aria-pressed={active} data-active={active || undefined}
    data-browser-category-id={categoryId} data-drop-target={dropTarget || undefined} draggable={draggable}
    onClick={onClick} onContextMenu={onContextMenu} onDragEnd={onDragEnd} onDragStart={onDragStart}
    title={showTooltip ? label : undefined} type="button">
    <span><Icon aria-hidden="true" size={14} strokeWidth={2} /><b>{label}</b></span>
    {count != null && (!categoryId || count > 0 || unresolved > 0) && <i title={unresolved ? `${count} visible / ${unresolved} unresolved` : `${count} visible`}>
      {count}{unresolved ? ` / ${unresolved} U` : ''}
    </i>}
  </button>;
}

function LibraryResults({ assets, emptyLabel, expandedImageIds, onActivate, onContext, onPointerDown, onToggleImages, onImageActivate, workspace }) {
  if (!assets.length) return <p className="lattice-browser-status">{emptyLabel}</p>;
  const selected = new Set(workspace.selectedAssetIds);
  const size = Math.min(BROWSER_ASSET_SIZE.MAXIMUM, Math.max(BROWSER_ASSET_SIZE.MINIMUM,
    Number(workspace.assetSize) || BROWSER_ASSET_SIZE.DEFAULT));
  const gridProps = {className:'lattice-browser-assets', 'data-labels':workspace.hideLabels ? 'hidden' : 'visible',
    'data-size':'grid', style:{'--library-tile-size':size + 'px'},
    onKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault(); event.stopPropagation(); workspace.selectAllVisible();
      }
    }};
  function renderAsset(asset) {
      const id = assetId(asset); const isSelected = selected.has(id) && workspace.selectedImage?.assetId !== id;
      const curated = workspace.selectedCategory ? (workspace.selectedCategory.imageSelections || []).filter(entry => entry.assetId === id)
        : workspace.curationRole === 'destination' || workspace.curatedPicker ? workspace.curatedImages?.get(id) || [] : [];
      if (curated.length && !asset.missingSnapshot) return curated.map(({ url }, index) =>
        <div className="system-workflow__library-item" data-library-asset-id={id} key={`${id}:${url}`}>
          <ImageChoice asset={asset} choice={{ ...libraryImageChoices(asset).find(choice => choice.sources.includes(url)), sources: [url], originalImageUrl: url, imageUrl: url }} number={index + 1} onActivate={onImageActivate}
            onPointerDown={onPointerDown} workspace={workspace} onContext={onContext} />
        </div>);
      const opensCollection = asset.isCollection && asset.collectionRole !== 'cover';
      const relationships = asset.collectionRole === 'cover'
        ? [asset.collectionPreviewTokenId ? 'COLLECTION Â· TOKEN PREVIEW' : 'COLLECTION COVER']
        : [asset.owned ? 'OWNED' : null, asset.collectionPreviewTokenId ? 'TOKEN PREVIEW' : null,
          asset.creatorRelationship === 'collection' ? 'FROM CREATED COLLECTION' : asset.created ? 'CREATED' : null,
          asset.created && !asset.owned ? 'NOT OWNED' : null].filter(Boolean);
      const choices = opensCollection ? [] : libraryImageChoices(asset);
      const files = (asset.fileAttachments || asset.assetRecord?.fileAttachments || []).filter(file => resolvePublishedAssetUrl(file.url));
      const imageCount = choices.length;
      const expanded = expandedImageIds.has(id);
      return [<div className="system-workflow__library-item" data-library-asset-id={id} key={id}><button aria-label={[asset.title || id, asset.collection].filter(Boolean).join(' / ')} aria-pressed={isSelected}
        className="lattice-browser-asset" data-collection={opensCollection || undefined}
        data-multi-selected={isSelected && selected.size > 1 || undefined} data-selected={isSelected || undefined}
        draggable={!opensCollection} key={id}
        onClick={(event) => opensCollection ? onActivate?.(event, asset) : workspace.selectAsset(id, event)}
        onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); onContext?.(event, asset); }}
        onDoubleClick={(event) => { if (!opensCollection) onActivate?.(event, asset); }}
        onPointerDown={(event) => onPointerDown?.(event, asset)}
        onDragStart={(event) => { event.dataTransfer.effectAllowed = 'copy';
          event.dataTransfer.setData('application/x-inscape-asset', id); event.preventDefault(); }}
        onKeyDown={(event) => { if (event.key === 'ContextMenu' || event.shiftKey && event.key === 'F10') {
          event.preventDefault(); event.stopPropagation(); onContext?.(event, asset);
        } }} type="button">
        <span className="lattice-browser-asset__media">
          {workspace.curationRole === 'source' && <CurationMark entries={workspace.curatedImages?.get(id)} />}
          <LazyLibraryArtwork asset={asset} id={id} workspace={workspace} />
        </span>
        {!workspace.hideLabels && <span className="lattice-browser-asset__record"><strong>{librarySourceLabel(asset) || id}</strong>
          {asset.collection && <small>{asset.collection}</small>}
          {relationships.length > 0 && <span className="lattice-browser-asset__relationships">
            {relationships.map((relationship) => <small key={relationship}>{relationship}</small>)}
          </span>}
        </span>}
      </button>
        {(imageCount > 1 || files.length > 0) && <button className="system-workflow__library-images-trigger" type="button"
          data-library-images-for={id} aria-expanded={expanded}
          title={`${expanded ? 'Fold' : 'Show'} ${imageCount} images in Library`}
          aria-label={`${expanded ? 'Fold' : 'Show'} ${imageCount} images of ${asset.title || id}`}
          onClick={() => onToggleImages(id)}>
          {imageCount}</button>}
      </div>, ...(expanded ? choices.slice(workspace.curationRole ? 0 : 1).map((choice, index) =>
        <div className="system-workflow__library-item" key={id + ':' + choice.sources.join('|')}>
          <ImageChoice asset={asset} choice={choice} number={index + (workspace.curationRole ? 1 : 2)} onActivate={onImageActivate}
            onPointerDown={onPointerDown} workspace={workspace} onContext={onContext} />
        </div>) : []), ...(expanded ? files.map(file => <a className="library-file-card" key={file.url}
          href={resolvePublishedAssetUrl(file.url)} target="_blank" rel="noopener noreferrer" title="Open attachment">
          <span>{libraryFileFormat(file.url, file.fileType)}</span><strong>{libraryFilename(file.url)}</strong></a>) : [])];
  }
  if (workspace.curationRole === 'source' && assets.length > 60) {
    // Expanded image/file cells share the same virtual row sequence as their parent.
    const cells = assets.flatMap(asset => expandedImageIds.has(assetId(asset)) ? renderAsset(asset) : [asset]);
    return <SourceCardGrid {...gridProps} cells={cells} renderCell={cell => isValidElement(cell) ? cell : renderAsset(cell)[0]} />;
  }
  return <div {...gridProps}>{assets.flatMap(renderAsset)}</div>;
}

function contextAnchor(event) {
  if (event.type === 'contextmenu') return { x: event.clientX, y: event.clientY };
  const bounds = event.currentTarget.getBoundingClientRect();
  return { x: bounds.left + Math.min(18, bounds.width / 2), y: bounds.bottom };
}

export default function OwnerSystemWorkflowLibraryPresenter({ categoryCommands, categoryDrag, data, dropFeedback, open = true,
  onAssetActivate, onAssetPointerDown, onImageActivate, navigationTargetRef, workspace }) {
  // Temporary browsing state, retained across filtering and closing the drawer.
  // The workspace keys this presenter by profile; no authored data is changed.
  const [expandedImageIds, setExpandedImageIds] = useState(() => new Set());
  const toggleImages = (id) => setExpandedImageIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const categorySectionRef = useRef(null), panelRef = useRef(null), foldersButton = useRef(null);
  const compact = workspace.navigationMode === 'icons';
  const [foldersOpen, setFoldersOpen] = useState(false), [treeDrop, setTreeDrop] = useState(null);
  const closeFolders = (focus = false) => { setFoldersOpen(false); if (focus) foldersButton.current?.focus(); };
  useEffect(() => { if (!open || !compact) setFoldersOpen(false); }, [open, compact]);
  const [dropPickerBounds, setDropPickerBounds] = useState(null);
  useLayoutEffect(() => {
    if (!foldersOpen) return;
    const panel = panelRef.current?.getBoundingClientRect(), trigger = foldersButton.current?.getBoundingClientRect();
    if (!panel || !trigger) return;
    const maxHeight = Math.min(300, panel.height - 16);
    setDropPickerBounds({ top: Math.max(8, Math.min(trigger.top - panel.top, panel.height - maxHeight - 8)), maxHeight });
  }, [foldersOpen]);
  useLayoutEffect(() => {
    if (!navigationTargetRef) return;
    navigationTargetRef.current = {
      hover(point) { const box = foldersButton.current?.getBoundingClientRect();
        if (compact && box && point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom) setFoldersOpen(true); },
      finish() { setFoldersOpen(false); },
    };
    return () => { navigationTargetRef.current = null; };
  }, [compact, navigationTargetRef]);
  const [contextMenu, setContextMenu] = useState(null); const [organizationDrag, setOrganizationDrag] = useState(null);
  const collapsedSections = new Set(workspace.collapsedSections);
  const setCollapsedSections = change => workspace.setCollapsedSections(current => [...change(new Set(current))]);
  const { relationshipView, setRelationshipView } = workspace;
  const { restoreFocus, cancelFocusReturn } = useDeferredFocusReturn();
  const closeContextMenu = (restore = true) => { const trigger = contextMenu?.trigger; cancelFocusReturn(); clearOwnerSystemWorkflowDocumentSelection(); setContextMenu(null); if (restore) restoreFocus(trigger); };
  const closeDialog = () => { const target = workspace.dialog?.returnFocus; clearOwnerSystemWorkflowDocumentSelection(); workspace.setDialog(null); restoreFocus(target); };
  const openDialog = (trigger, dialog) => {
    cancelFocusReturn();
    const parent = trigger?.parentElement, index = parent ? [...parent.children].indexOf(trigger) : -1;
    workspace.setDialog({ ...dialog, returnFocus: () => trigger?.isConnected ? trigger
      : parent?.isConnected ? parent.children[index] : categorySectionRef.current?.querySelector('button') || foldersButton.current });
  };
  const openCreateDialog = (event, kind = 'category', sectionId = null, parentId = null) => {
    if (compact) { setRelationshipView('all'); workspace.selectView({ kind: parentId ? BROWSER_VIEW_KINDS.CATEGORY : BROWSER_VIEW_KINDS.FOLDERS, id: parentId }); }
    if (parentId) setCollapsedSections(current => { const next = new Set(current); next.delete('folder:' + parentId); return next; });
    if (sectionId) setCollapsedSections(current => { const next = new Set(current); next.delete(sectionId); return next; });
    openDialog(event.currentTarget, { type: `create-${kind}`, sectionId, parentId }); };
  const openCategoryContext = (event, category) => { cancelFocusReturn(); setContextMenu({ anchor: contextAnchor(event), categoryId: category.id, kind: 'category', trigger: event.currentTarget }); };
  const openSectionContext = (event, section) => { if (data.curatedPicker) return; cancelFocusReturn(); setContextMenu({ anchor: contextAnchor(event), sectionId: section.id, kind: 'section', trigger: event.currentTarget }); };
  const openAssetContext = (event, asset) => {
    if (data.curatedPicker) return;
    cancelFocusReturn();
    const imageUrl = libraryCategoryImage(asset);
    const ids = imageUrl ? [assetId(asset)] : workspace.selectForContext(assetId(asset));
    setContextMenu({ anchor: contextAnchor(event), assetIds: ids, imageUrl, imageReady: Boolean(asset.selectedMedia), imageUrls: libraryImageChoices(asset).map(choice => choice.sources[0]), kind: 'membership', trigger: event.currentTarget });
  };
  const categoryMenuCommands = contextMenu?.kind === 'category' ? (() => {
    const category = data.categories.find(({ id }) => id === contextMenu.categoryId);
    return category ? [{ id: 'start-category', label: 'Open Library here', checkable: true, selected: workspace.startCategoryId === category.id },
      ...(data.curatedPicker ? [] : [{ id: 'new-folder', label: 'New subfolder' }, { id: 'rename', label: 'Rename' },
      ...(categoryCommands?.moveCategory ? [{ id: 'move-root', label: 'Move / Outside sections' },
        ...(data.categoryOrganization?.sections || []).map((section) => ({ id: `move-section:${section.id}`, label: `Move / ${section.name}` }))] : []),
      { id: 'delete', label: 'Delete' }])] : [];
  })() : [];
  const sectionMenuCommands = contextMenu?.kind === 'section' ? [{ id: 'rename-section', label: 'Rename' },
    { id: 'delete-section', label: 'Delete section / keep categories' }] : [];
  const membershipIds = contextMenu?.kind === 'membership' ? contextMenu.assetIds : workspace.selectedAssetIds;
  const currentMembershipCategory = workspace.view.kind === BROWSER_VIEW_KINDS.CATEGORY
    ? data.categories.find(({ id }) => id === workspace.view.id) : null;
  const folderMembershipCommands = data.categories.length ? data.categories.flatMap((category) => {
    const command = { checkable: true, id: `membership:${category.id}`, label: category.name,
      mixed: categoryMembershipState(category, membershipIds, contextMenu?.imageUrl) === 'mixed',
      selected: categoryMembershipState(category, membershipIds, contextMenu?.imageUrl) === 'all' };
    return currentMembershipCategory?.id === category.id
      ? [{ id: `remove-current:${category.id}`, label: `Remove from ${category.name}` }, command] : [command];
  }) : [{ id: 'no-categories', label: 'No categories yet', disabled: true }];
  const membershipCommands = data.curationRole === 'source' ? [{ id: 'curate', label: 'Add to Inscape Library' }]
    : data.curationRole === 'destination' ? [...folderMembershipCommands, { id: 'uncurate', label: 'Remove from Inscape Library' }] : folderMembershipCommands;
  const handleContextCommand = (commandId) => {
    if (commandId === 'curate' || commandId === 'uncurate') {
      data.onCurationAction(membershipIds, null, contextMenu.imageReady ? contextMenu.imageUrl : null, contextMenu.imageUrls); closeContextMenu(); return;
    }
    if (contextMenu?.kind === 'section') {
      const section = data.categoryOrganization?.sections?.find(({ id }) => id === contextMenu.sectionId);
      if (!section) return closeContextMenu();
      const trigger = contextMenu.trigger; closeContextMenu(false);
      if (commandId === 'delete-section') { openDialog(trigger, { section, type: 'delete-section' }); return; }
      openDialog(trigger, { section, type: commandId }); return;
    }
    if (contextMenu?.kind === 'category') {
      const category = data.categories.find(({ id }) => id === contextMenu.categoryId);
      if (!category) return closeContextMenu();
      const trigger = contextMenu.trigger; closeContextMenu(false);
      if (commandId === 'new-folder') {
        setCollapsedSections(current => { const next = new Set(current); next.delete('folder:' + category.id); return next; });
        openCreateDialog({ currentTarget: trigger }, 'category', null, category.id); return;
      }
      if (commandId === 'start-category') {
        workspace.setStartCategory(workspace.startCategoryId === category.id ? null : category.id);
        restoreFocus(trigger); return;
      }
      if (commandId === 'move-root' || commandId.startsWith('move-section:')) {
        categoryCommands.moveCategory?.(category.id, commandId === 'move-root' ? null : commandId.slice('move-section:'.length));
        restoreFocus(trigger); return;
      }
      openDialog(trigger, { category, type: commandId === 'rename' ? 'rename-category' : commandId }); return;
    }
    if (contextMenu?.kind !== 'membership' || !contextMenu.imageReady && !workspace.areAssetsRenderable(contextMenu.assetIds)) return closeContextMenu();
    const assign = (categoryId, included) => contextMenu.imageUrl
      ? categoryCommands.setCategoryImage(categoryId, contextMenu.assetIds[0], contextMenu.imageUrl, included)
      : categoryCommands.setCategoryAssets(categoryId, contextMenu.assetIds, included);
    if (commandId.startsWith('remove-current:')) {
      assign(commandId.slice('remove-current:'.length), false);
    } else {
      const categoryId = commandId.slice('membership:'.length);
      const category = data.categories.find(({ id }) => id === categoryId);
      if (category) assign(category.id, true);
    }
    closeContextMenu();
  };
  const beginOrganizationDrag = (event, asset, mediaWorkspace = workspace) => {
    if (asset.isCollection && asset.collectionRole !== 'cover') return;
    const id = assetId(asset); const selectedIds = !asset.selectedMedia && workspace.selectedAssetIds.includes(id) ? [...workspace.selectedAssetIds] : [id];
    onAssetPointerDown?.(event, asset, mediaWorkspace, { placementPreset: 'compact', assetIds: selectedIds, sourceFolderId: workspace.selectedCategory?.id });
  };
  const confirmDialog = (name) => {
    const dialog = workspace.dialog; if (!dialog) return;
    const result = dialog.type === 'create-category' ? categoryCommands.createCategory(name, dialog.sectionId, dialog.parentId)
      : dialog.type === 'create-section' ? categoryCommands.createSection?.(name)
        : dialog.type === 'rename-category' ? categoryCommands.renameCategory(dialog.category.id, name)
          : dialog.type === 'rename-section' ? categoryCommands.renameSection?.(dialog.section.id, name)
            : dialog.type === 'delete-section' ? categoryCommands.deleteSection?.(dialog.section.id)
              : categoryCommands.deleteCategory(dialog.category.id);
    if (!result) { workspace.setDialog({ ...dialog, error: 'Profile authority changed or command could not be saved.' }); return; }
    if (dialog.type === 'create-category') workspace.selectView({ kind: BROWSER_VIEW_KINDS.CATEGORY, id: result }); closeDialog();
  };
  const confirmDeleteDialog = () => {
    const dialog = workspace.dialog; if (!dialog) return;
    const result = dialog.type === 'delete-section'
      ? categoryCommands.deleteSection?.(dialog.section.id)
      : categoryCommands.deleteCategory?.(dialog.category.id);
    if (!result) { workspace.setDialog({ ...dialog, error: 'Profile authority changed or command could not be saved.' }); return; }
    closeDialog();
  };
  const assets = workspace.renderableAssets; const categories = data.categories || []; const renderableIds = new Set(workspace.renderableAssetIds);
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const organization = data.categoryOrganization || { rootCategoryIds: categories.map(({ id }) => id), sections: [] };
  const organizedIds = new Set([...(organization.rootCategoryIds || []),
    ...(organization.sections || []).flatMap(({ categoryIds }) => categoryIds || [])]);
  const rootCategoryIds = [...(organization.rootCategoryIds || []), ...categories.filter(({ id, parentId }) => !parentId && !organizedIds.has(id)).map(({ id }) => id)];
  const related = workspace.filteredAssets;
  const viewLabel = data.collectionContext?.name || (workspace.view.kind === BROWSER_VIEW_KINDS.FOLDERS
    ? 'Folders' : workspace.selectedCategory?.name || 'All assets');
  const resultsRef = useRef(null);
  useLayoutEffect(() => {
    if (data.curationRole === 'source' && resultsRef.current) resultsRef.current.scrollTop = 0;
  }, [data.curationRole, data.ownerContext, workspace.query, workspace.collection, relationshipView]);
  const visibleRef = useRef(new Set());
  const demand = data.onMetadataDemand;
  const selectedKey = workspace.selectedAssetIds.join(',');
  const assetKey = related.map(assetId).join(',');
  useEffect(() => {
    visibleRef.current = new Set();
    if (!open || !demand || !resultsRef.current) return undefined;
    const selected = selectedKey ? selectedKey.split(',') : [];
    const publish = () => demand([...new Set([...selected, ...visibleRef.current])]);
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const id = entry.target.dataset.libraryAssetId;
        if (entry.isIntersecting) visibleRef.current.add(id); else visibleRef.current.delete(id);
      }
      publish();
    }, { root: resultsRef.current, rootMargin: '150px' });
    const root = resultsRef.current;
    const selector = '[data-library-asset-id]';
    root.querySelectorAll(selector).forEach(node => observer.observe(node));
    const mutations = new MutationObserver(changes => {
      for (const {addedNodes, removedNodes} of changes) {
        for (const node of removedNodes) if (node.matches?.(selector)) {
          observer.unobserve(node); visibleRef.current.delete(node.dataset.libraryAssetId);
        }
        for (const node of addedNodes) if (node.matches?.(selector)) observer.observe(node);
      }
    });
    mutations.observe(root, {childList:true, subtree:true});
    publish();
    return () => { mutations.disconnect(); observer.disconnect(); demand([]); };
  }, [open, demand, selectedKey, assetKey]);
  const selectBuiltIn = (view) => { setRelationshipView('all'); workspace.selectView(view); closeFolders(); };
  const beginTreeDrag = (event, payload) => {
    event.stopPropagation(); event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-inscape-library-tree', JSON.stringify(payload));
    setOrganizationDrag({ tree: payload });
  };
  const readTreeDrag = (event) => { try { return JSON.parse(event.dataTransfer.getData('application/x-inscape-library-tree')); } catch { return null; } };
  const acceptTreeDrop = (event, target) => {
    event.preventDefault(); event.stopPropagation(); const payload = readTreeDrag(event); setOrganizationDrag(null); setTreeDrop(null); if (!payload) return;
    if (payload.kind === 'category') categoryCommands.moveCategory?.(payload.id, target.sectionId || null, target.beforeId || null, target.parentId || null);
    if (payload.kind === 'section' && target.kind === 'section') categoryCommands.moveSection?.(payload.id, target.beforeId || null);
  };
  const renderCategory = (categoryId, sectionId = null) => {
    const category = categoriesById.get(categoryId); if (!category) return null;
    const editing = workspace.dialog?.type === 'rename-category' && workspace.dialog.category?.id === category.id;
    const deleting = workspace.dialog?.type === 'delete' && workspace.dialog.category?.id === category.id;
    const active = relationshipView === 'all' && workspace.view.kind === BROWSER_VIEW_KINDS.CATEGORY
      && workspace.view.id === category.id;
    const children = categories.filter(folder => folder.parentId === categoryId);
    const collapsed = collapsedSections.has('folder:' + categoryId);
    const naming = workspace.dialog?.type === 'create-category' && workspace.dialog.parentId === categoryId;
    return <div className="system-workflow__library-tree-category" data-nested={sectionId || category.parentId ? true : undefined}
      data-active={active || undefined} key={category.id}
      data-tree-drop={treeDrop?.id === category.id ? treeDrop.kind : undefined}
      onDragOver={event => { if (organizationDrag?.tree?.kind !== 'category') return;
        event.preventDefault(); event.stopPropagation();
        setTreeDrop({ id: category.id, kind: event.clientY < event.currentTarget.getBoundingClientRect().top + 7 ? 'before' : 'inside' }); }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setTreeDrop(null); }}
      onDrop={event => acceptTreeDrop(event, treeDrop?.id === category.id && treeDrop.kind === 'before'
        ? { sectionId, parentId: category.parentId, beforeId: category.id } : { parentId: category.id })}>
      <div className="library-folder-row">
      {(children.length > 0 || naming) && <button type="button" className="library-folder-disclosure"
        aria-label={(collapsed ? 'Expand ' : 'Collapse ') + category.name} aria-expanded={!collapsed}
        onClick={() => setCollapsedSections(current => { const next = new Set(current);
          if (collapsed) next.delete('folder:' + categoryId); else next.add('folder:' + categoryId); return next; })}>
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}</button>}
      {!children.length && !naming && <span className="library-folder-disclosure-space" aria-hidden="true" />}
      {deleting ? <OwnerSystemWorkflowSidebarDeleteConfirmation entityLabel="folder" name={category.name}
        onCancel={closeDialog} onConfirm={confirmDeleteDialog} />
        : editing ? <OwnerSystemWorkflowSidebarEditor dialog={workspace.dialog} entityLabel="folder"
          onCancel={closeDialog} onConfirm={confirmDialog} /> : <LibraryNavigationButton
        active={active}
        categoryId={category.id} count={category.assetIds.filter((id) => renderableIds.has(id))
          .reduce((count, id) => count + ((category.imageSelections || []).filter(entry => entry.assetId === id).length || 1), 0)}
        draggable={!data.curatedPicker} dropTarget={categoryDrag?.categoryId === category.id} label={category.name}
        onClick={() => selectBuiltIn({ kind: BROWSER_VIEW_KINDS.CATEGORY, id: category.id })}
        onContextMenu={(event) => { event.preventDefault(); openCategoryContext(event, category); }}
        onDragEnd={() => { setOrganizationDrag(null); setTreeDrop(null); }}
        onDragStart={(event) => beginTreeDrag(event, { kind: 'category', id: category.id })}
        unresolved={category.assetIds.filter((id) => !renderableIds.has(id)).length} />}
      </div>
      {!collapsed && (children.length > 0 || naming) && <div className="library-folder-children">
        {naming && <OwnerSystemWorkflowSidebarEditor dialog={workspace.dialog} entityLabel="folder" onCancel={closeDialog} onConfirm={confirmDialog} />}
        {children.map(folder => renderCategory(folder.id, sectionId))}
      </div>}
    </div>;
  };
  const emptyLabel = data.status === 'loading' ? (data.collectionContext ? 'Loading collection tokens' : 'Loading assets')
    : data.collectionContext && data.status === 'error' ? 'Collection tokens unavailable'
      : data.remoteSearch ? 'No matching assets in this profile view'
      : workspace.hasActiveFilters && workspace.viewAssetCount
        ? `${workspace.viewAssetCount} assets are in this view / none match the active search or filters`
        : data.hasMore ? 'No matches in loaded assets' : 'No assets in this view';
  const folderHome = workspace.view.kind === BROWSER_VIEW_KINDS.FOLDERS;
  const visibleFolders = folderHome ? categories.filter(folder => !folder.parentId)
    : workspace.selectedCategory ? categories.filter(folder => folder.parentId === workspace.selectedCategory.id) : [];
  const breadcrumbs = [];
  for (let folder = workspace.selectedCategory; folder && breadcrumbs.length < categories.length; folder = categoriesById.get(folder.parentId)) breadcrumbs.unshift(folder);
  const folderTiles = folders => <div className="library-folder-grid">{folders.map(folder => {
    const images = (folder.imageSelections || []).map(image => libraryPreviewUrl(image.url, 128));
    const previews = images.length ? images : folder.assetIds.map(id => assets.find(asset => assetId(asset) === id)?.previewSrc).filter(Boolean);
    return <button type="button" className="library-folder-tile" data-library-folder-tile data-browser-category-id={folder.id}
      data-drop-target={categoryDrag?.categoryId === folder.id || undefined} key={folder.id}
      onClick={() => selectBuiltIn({ kind: BROWSER_VIEW_KINDS.CATEGORY, id: folder.id })}
      onContextMenu={event => { event.preventDefault(); openCategoryContext(event, folder); }}
      onDragOver={event => { if (organizationDrag?.tree?.kind === 'category') event.preventDefault(); }}
      onDrop={event => acceptTreeDrop(event, { parentId: folder.id })}>
      <span className="library-folder-cover" data-preview-count={Math.min(previews.length, 4)}><Folder size={16} strokeWidth={1.5} />
        {previews.slice(0, 4).map(url => <LibraryArtworkImage key={url} alt="" loading="lazy" draggable="false" src={url} />)}</span>
      <strong>{folder.name}</strong><small>{folder.assetIds.length} assets</small>
    </button>;
  })}</div>;
  const sectionHeader = section => {
    const collapsed = collapsedSections.has(section.id);
    const editing = !compact && workspace.dialog?.type === 'rename-section' && workspace.dialog.section?.id === section.id;
    const deleting = !compact && workspace.dialog?.type === 'delete-section' && workspace.dialog.section?.id === section.id;
    return <header>
                {deleting ? <OwnerSystemWorkflowSidebarDeleteConfirmation entityLabel="section" name={section.name}
                  onCancel={closeDialog} onConfirm={confirmDeleteDialog} />
                  : editing ? <OwnerSystemWorkflowSidebarEditor dialog={workspace.dialog} entityLabel="section"
                    onCancel={closeDialog} onConfirm={confirmDialog} /> : <><button className="system-workflow__library-section-toggle" title={section.name} aria-expanded={!collapsed}
                    draggable={!data.curatedPicker}
                    onClick={() => setCollapsedSections((current) => { const next = new Set(current);
                      if (next.has(section.id)) next.delete(section.id); else next.add(section.id); return next; })}
                    onContextMenu={(event) => { event.preventDefault(); openSectionContext(event, section); }}
                    onDragEnd={() => { setOrganizationDrag(null); setTreeDrop(null); }}
                    onDragStart={(event) => beginTreeDrag(event, { kind: 'section', id: section.id })}
                    type="button">
                    <span>{collapsed ? <ChevronRight aria-hidden="true" size={12} /> : <ChevronDown aria-hidden="true" size={12} />}
                      <b>{section.name}</b></span>
                  </button>
                  <button type="button" className="system-workflow__library-section-add"
                    aria-label={`Add folder to ${section.name}`} title="Add folder"
                    disabled={!categoryCommands?.createCategory}
                    onClick={event => openCreateDialog(event, 'category', section.id)}>
                    <FolderPlus aria-hidden="true" size={16} strokeWidth={1.5} />
                  </button></>}
              </header>;
  };
  const folderTree = <div className="library-folder-tree" ref={categorySectionRef}>
    {(compact || organizationDrag?.tree?.kind === 'category') && <header className="library-tree-heading" data-tree-drop={treeDrop?.id === 'root' ? 'section' : undefined}
      onDragOver={event => { if (organizationDrag?.tree?.kind === 'category') { event.preventDefault(); setTreeDrop({ id: 'root', kind: 'section' }); } }}
      onDragLeave={() => setTreeDrop(null)} onDrop={event => acceptTreeDrop(event, { sectionId: null })}>
      <span>{compact ? 'Drop into a folder' : 'Move to root'}</span>
    </header>}
    {workspace.dialog?.type === 'create-category' && !workspace.dialog.sectionId && !workspace.dialog.parentId
      && <OwnerSystemWorkflowSidebarEditor dialog={workspace.dialog} entityLabel="folder" onCancel={closeDialog} onConfirm={confirmDialog} />}
    <div className="lattice-browser-category-list system-workflow__library-tree">
      {rootCategoryIds.map(id => renderCategory(id))}
          {(organization.sections || []).map((section) => {
            const collapsed = collapsedSections.has(section.id);
            return <section className="system-workflow__library-section" data-collapsed={collapsed || undefined}
              data-tree-drop={treeDrop?.id === section.id ? 'section' : undefined} key={section.id}
              onDragOver={event => { if (!organizationDrag?.tree) return; event.preventDefault(); event.stopPropagation(); setTreeDrop({ id: section.id, kind: 'section' }); }}
              onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setTreeDrop(null); }} onDrop={(event) => acceptTreeDrop(event,
                organizationDrag?.tree?.kind === 'section' ? { kind: 'section', beforeId: section.id } : { sectionId: section.id })}>
              {sectionHeader(section)}
              {!collapsed && <div className="system-workflow__library-section-children">
                {workspace.dialog?.type === 'create-category' && workspace.dialog.sectionId === section.id
                  && <OwnerSystemWorkflowSidebarEditor dialog={workspace.dialog} entityLabel="folder"
                    onCancel={closeDialog} onConfirm={confirmDialog} />}
                {section.categoryIds.map((id) => renderCategory(id, section.id))}
                {!section.categoryIds.length && organizationDrag?.tree?.kind === 'category'
                  && <span className="system-workflow__library-section-empty">Drop folder here</span>}
              </div>}
            </section>;
          })}
    </div>
    {workspace.dialog?.type === 'create-section' && <OwnerSystemWorkflowSidebarEditor dialog={workspace.dialog} entityLabel="section" onCancel={closeDialog} onConfirm={confirmDialog} />}
    {!data.curationRole && !data.curatedPicker && !categories.length && !organization.sections.length && !workspace.dialog && <p className="library-tree-empty">Create a folder using New.</p>}
  </div>;
  const navigationKeys = event => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key) || event.target.matches('input')) return;
    const buttons = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
    const index = buttons.indexOf(document.activeElement); if (index < 0) return;
    event.preventDefault(); buttons[Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  };
  const [newAnchor, setNewAnchor] = useState(null);
  const newTrigger = useRef(null);
  const navigation = <nav aria-label="Browser navigation" className="lattice-browser-sidebar" onKeyDown={navigationKeys}>
    {data.curationRole === 'destination' && <div className="curation-new">
      <button type="button" ref={newTrigger} aria-haspopup="menu" aria-expanded={Boolean(newAnchor)} onClick={() => {
        const box = newTrigger.current.getBoundingClientRect();
        setNewAnchor(newAnchor ? null : { x: box.left, y: box.bottom });
      }}>+ New <ChevronDown size={12} style={{ rotate: newAnchor ? '180deg' : undefined }} /></button>
      {newAnchor && createPortal(<RackMenu preferredWidth={128} className="system-workflow__token-scope library-new-menu" label="New Library item" palette="editor" anchor={newAnchor}
        commands={[{ id: 'section', label: 'Section' }, { id: 'category', label: 'Folder' }]}
        returnFocus={newTrigger.current} onClose={() => setNewAnchor(null)} onCommand={kind => {
          setNewAnchor(null); openCreateDialog({ currentTarget: newTrigger.current }, kind);
        }} />, document.body)}
    </div>}
    {data.collectionContext ? <>
      <LibraryNavigationButton showTooltip={!foldersOpen} count={null} icon={ArrowLeft} label="Back to all assets" onClick={() => { setRelationshipView('all'); data.onCloseCollection?.(); }} />
      <LibraryNavigationButton showTooltip={!foldersOpen} active count={data.collectionContext.total ?? assets.length} icon={Images} label={data.collectionContext.name || 'Collection'} onClick={() => {}} />
    </> : <>
      <LibraryNavigationButton showTooltip={!foldersOpen} active={relationshipView === 'all' && workspace.view.kind === BROWSER_VIEW_KINDS.ALL}
        count={data.curatedCount ?? (assets.length + (data.hasMore ? '+' : ''))} icon={Layers3} label="All Assets" onClick={() => selectBuiltIn({ kind: BROWSER_VIEW_KINDS.ALL, id: null })} />
      <button type="button" ref={foldersButton} className="library-folders-destination" aria-label="Folders" title={foldersOpen ? undefined : 'Folders'}
        data-active={folderHome || workspace.view.kind === BROWSER_VIEW_KINDS.CATEGORY || undefined}
        onClick={() => selectBuiltIn({ kind: BROWSER_VIEW_KINDS.FOLDERS, id: null })}>
        <span><Folder size={14} strokeWidth={1.5} /><b>Folders</b></span><i>{categories.length}</i>
      </button>
      {!compact && folderTree}
    </>}
  </nav>;
  return <div className="system-workflow__library-presenter" data-navigation={compact ? 'icons' : 'names'} onKeyDown={(event) => {
    if (event.key !== 'Escape') return;
    if (workspace.dialog) { event.stopPropagation(); closeDialog(); }
    else if (contextMenu) { event.stopPropagation(); closeContextMenu(); }
    else if (foldersOpen) { event.stopPropagation(); closeFolders(true); }
    else if (workspace.selectedAssetIds.length) { event.stopPropagation(); workspace.clearSelection(); }
  }}>
    <LibraryBrowseControls curationRole={data.curationRole} workspace={workspace} onCreate={openCreateDialog}
      canCreateFolder={Boolean(categoryCommands?.createCategory)} canCreateSection={Boolean(categoryCommands?.createSection)} />
    <div className="lattice-browser-panel" ref={panelRef} style={{ '--lattice-browser-sidebar-width': `${workspace.sidebarWidth}px` }}>
      {data.curationRole !== 'source' && <>{navigation}
      <button aria-label="Resize Browser navigation" className="lattice-browser-sidebar-resize"
        disabled={compact || Boolean(workspace.dialog)}
        onLostPointerCapture={workspace.sidebarResize.finish} onPointerCancel={workspace.sidebarResize.finish}
        onPointerDown={workspace.sidebarResize.begin} onPointerMove={workspace.sidebarResize.update}
        onPointerUp={workspace.sidebarResize.finish} title="Resize Browser navigation" type="button" /></>}
      {compact && foldersOpen && <div className="library-folder-drop-picker" role="dialog" aria-label="File artwork into folder" style={dropPickerBounds} onKeyDown={navigationKeys}>
        {folderTree}
      </div>}
      <main data-curation-folder={data.curationRole === 'destination' ? workspace.selectedCategory?.id || '' : undefined} aria-label={viewLabel} className="lattice-browser-results" ref={resultsRef} onScroll={event => {
        const node = event.currentTarget;
        if (open && data.hasMore && !data.loadingMore && !workspace.hasActiveFilters
          && node.scrollHeight - node.scrollTop - node.clientHeight < node.clientHeight * .75) data.onLoadMore?.();
      }}>
        {data.curatedPicker && data.onOpenCuration && <button type="button" onClick={data.onOpenCuration}>Open Curation</button>}
        {data.curationRole === 'source' && (workspace.hasActiveFilters || data.hasMore || data.sourceMode === 'RPC') &&
          <p className="lattice-browser-notice" role="status">{data.remoteSearch
            ? data.loadingMore ? 'Searching profile inventory...' : 'Profile search / ' + workspace.viewAssetCount + ' matches loaded'
            : (workspace.hasActiveFilters || data.collectionContext || data.sourceMode === 'RPC' ? 'Search loaded items / ' : '')
              + workspace.viewAssetCount + ' loaded'}
            {data.hasMore && <button type="button" disabled={data.loadingMore} onClick={data.onLoadMore}>Load more</button>}
          </p>}
        {data.curationRole !== 'source' && data.hasMore && <p className="lattice-browser-notice">{assets.length} assets loaded</p>}
        {dropFeedback && <div className="lattice-browser-notice" data-error role="status">{dropFeedback}</div>}
        {data.persistenceError && <div className="lattice-browser-notice" data-error role="alert">{data.persistenceError}</div>}
        {data.curationRole === 'source' && data.collectionContext && <button type="button" onClick={data.onCloseCollection}>Back to all assets</button>}
        {data.collectionContext && <div className="lattice-browser-notice" role="status">
          Created / {data.collectionContext.name || 'Collection'} Â· {data.collectionContext.resolved || 0} / {data.collectionContext.total || 0} tokens
        </div>}
        {data.error && <div className="lattice-browser-notice" data-error role="status">{data.error}</div>}
        {!data.collectionContext && data.error && data.onRetry
          && <button className="lattice-browser-notice" disabled={data.status === 'loading'}
            onClick={data.onRetry} type="button">Retry assets</button>}
        {data.collectionContext && data.error && data.onRetryCollection
          && <button className="lattice-browser-notice" onClick={data.onRetryCollection} type="button">Retry collection</button>}
        {data.createdError && <div className="lattice-browser-notice" data-error role="status">Created source unavailable{data.createdRetained ? ' / retained results' : ''}</div>}
        {data.createdError && data.onRetryCreated
          && <button className="lattice-browser-notice" onClick={data.onRetryCreated} type="button">Retry created works</button>}
        {data.createdStatus === 'loading' && <p className="lattice-browser-notice" role="status">Loading created {data.createdProgress?.resolved || 0} / {data.createdProgress?.total || 0}</p>}
        {data.collectionContext && data.status === 'loading' && <p className="lattice-browser-notice" role="status">Loading collection tokens {data.progress?.resolved || 0} / {data.progress?.total || 0}</p>}
        <div className="library-breadcrumbs" aria-label="Library location">
          {folderHome || breadcrumbs.length ? <><button type="button" onClick={() => selectBuiltIn({ kind: BROWSER_VIEW_KINDS.FOLDERS, id: null })}>Folders</button>
          {breadcrumbs.length ? breadcrumbs.map(folder => <span key={folder.id}><span aria-hidden="true">/</span><button type="button"
            onClick={() => selectBuiltIn({ kind: BROWSER_VIEW_KINDS.CATEGORY, id: folder.id })}>{folder.name}</button></span>)
            : null}</> : <span>{viewLabel}</span>}
        </div>
        {compact && workspace.dialog && (workspace.dialog.type.startsWith('delete')
          ? <OwnerSystemWorkflowSidebarDeleteConfirmation entityLabel={workspace.dialog.section ? 'section' : 'folder'}
              name={workspace.dialog.section?.name || workspace.dialog.category?.name} onCancel={closeDialog} onConfirm={confirmDeleteDialog} />
          : <OwnerSystemWorkflowSidebarEditor dialog={workspace.dialog} entityLabel={workspace.dialog.type.includes('section') ? 'section' : 'folder'} onCancel={closeDialog} onConfirm={confirmDialog} />)}
        {folderHome ? <>
          {folderTiles(visibleFolders.filter(folder => rootCategoryIds.includes(folder.id)))}
          {(organization.sections || []).map(section => <section className="system-workflow__library-section" key={section.id}>{sectionHeader(section)}
            {!collapsedSections.has(section.id) && folderTiles(visibleFolders.filter(folder => section.categoryIds.includes(folder.id)))}</section>)}
          {!categories.length && <p className="lattice-browser-status">Create a folder, then drag artwork into it from All Assets.</p>}
        </> : <>{visibleFolders.length > 0 && folderTiles(visibleFolders)}<LibraryResults assets={related} emptyLabel={data.curationRole === 'destination' && !workspace.hasActiveFilters && !data.curatedCount && !related.length && data.status !== 'loading' && !data.persistenceError && !data.error ? 'Drop works here' : emptyLabel} onActivate={onAssetActivate} onImageActivate={onImageActivate}
          expandedImageIds={expandedImageIds} onToggleImages={toggleImages}
          onContext={openAssetContext} onPointerDown={beginOrganizationDrag}
          workspace={workspace} /></>}
        {data.hasMore && data.curationRole !== 'source' && <button className="workflow-tactile-control" type="button" disabled={data.loadingMore}
          onClick={data.onLoadMore}>{data.loadingMore ? 'Loading more assets' : 'Load more assets'}</button>}
      </main>
    </div>
    {contextMenu && createPortal(<RackMenu anchor={contextMenu.anchor}
      commands={contextMenu.kind === 'category' ? categoryMenuCommands : contextMenu.kind === 'section' ? sectionMenuCommands : membershipCommands}
      label={contextMenu.kind === 'category' ? 'Category commands' : contextMenu.kind === 'section' ? 'Section commands' : 'NFT category membership'}
       onClose={() => closeContextMenu()} onCommand={handleContextCommand}
      returnFocus={contextMenu.trigger} systemWorkflowOverlay />, document.body)}
    {categoryDrag && createPortal(<div aria-hidden="true" className="system-workflow__library-drag-ghost"
      data-valid={categoryDrag.categoryId ? true : undefined}
      style={{ left: categoryDrag.point.x, top: categoryDrag.point.y }}>{categoryDrag.assetIds.length} assets</div>, document.body)}
  </div>;
}
