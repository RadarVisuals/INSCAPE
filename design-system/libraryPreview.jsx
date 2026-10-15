import React, { useEffect, useRef, useState } from 'react';
import LibraryWorkspace from '../src/public/ownerSystemWorkflow/OwnerSystemWorkflowLibraryWorkspace.jsx';
import {
  createEmptyWorkspace,
  createFolder,
  renameFolder,
  deleteFolder,
  createCategorySection,
  renameCategorySection,
  deleteCategorySection,
  moveCategory,
  moveCategorySection,
  setFolderAssets,
} from '../src/library/domain/libraryWorkspace.js';
import './libraryPreview.css';

const picture = (index, transparent = false) =>
  'data:image/svg+xml;base64,' +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${index === 2 ? 180 : 288}" height="${index === 2 ? 260 : 192}" viewBox="0 0 288 192">${transparent ? '' : `<rect width="288" height="192" fill="${['#d4d1c8', '#b6bfae', '#c6bbaa'][index % 3]}"/>`}<circle cx="218" cy="46" r="27" fill="#f1eee4"/><path d="M30 192V92a58 58 0 0 1 116 0v100Z" fill="${index % 2 ? '#6b7769' : '#a39680'}"/><path d="M116 192V132a65 65 0 0 1 130 0v60Z" fill="${index % 2 ? '#a39680' : '#586657'}"/></svg>`,
  );
function sampleAssets() {
  return [
    'Arch study',
    'Moon garden',
    'Tall composition',
    'Transparent shapes',
    'Evening field',
    'Quiet forms',
    'Studio collection',
  ].map((title, index) => {
    const src = picture(index, index === 3),
      id = 'library-example-' + index;
    return {
      id,
      stableAssetId: id,
      title,
      name: title,
      collection: index < 4 ? 'Shape studies' : 'Light studies',
      mediaType: 'image',
      src,
      previewSrc: src,
      previewCandidates: [src],
      imageUrl: src,
      originalImageUrl: src,
      thumbnailUrl: src,
      owned: index < 5,
      created: index === 4 || index === 6,
      placeable: false,
      isCollection: index === 6,
      imageGroups:
        index === 0
          ? [0, 1, 2].map((n) => ({
              index: n,
              originalImageUrl: n ? picture(n, true) : src,
              fileType: 'image/svg+xml',
            }))
          : [],
      assetRecord: { id, title, name: title },
      width: index === 2 ? 180 : 288,
      height: index === 2 ? 260 : 192,
    };
  });
}
function initialLibrary() {
  return {
    ...createEmptyWorkspace('design-system-library'),
    folders: [
      {
        id: 'studies',
        name: 'Studies',
        assetIds: ['library-example-0', 'library-example-2'],
        public: false,
      },
      { id: 'materials', name: 'Materials', assetIds: ['library-example-3'], public: false },
      { id: 'later', name: 'For later', assetIds: [], public: false },
    ],
    categoryOrganization: {
      rootCategoryIds: ['studies'],
      sections: [{ id: 'project', name: 'Current project', categoryIds: ['materials', 'later'] }],
    },
  };
}

export default function LibraryPreview({ open, theme, scenario, onScenarioChange, onClose, navigationHost }) {
  const [assets] = useState(sampleAssets),
    [library, setLibrary] = useState(initialLibrary),
    [collectionOpen, setCollectionOpen] = useState(false);
  const [preferences] = useState(() => ({ assetSize: 150, hideLabels: false, sidebarWidth: 174 })),
    [previewRecords] = useState(() => new Map());
  const root = useRef(null),
    placement = useRef({ captureTarget: () => null }),
    shortcut = useRef(null);
  useEffect(() => {
    if (open) root.current?.querySelector('input[type=search]')?.focus({ preventScroll: true });
  }, [open]);
  const apply = (operation, ...args) => {
    const next = operation(library, ...args);
    setLibrary(next);
    return next !== library;
  };
  const categoryCommands = {
    createCategory(name) {
      const next = createFolder(library, name);
      setLibrary(next);
      return next.folders.at(-1)?.id;
    },
    renameCategory: (...args) => apply(renameFolder, ...args),
    deleteCategory: (...args) => apply(deleteFolder, ...args),
    createSection: (...args) => apply(createCategorySection, ...args),
    renameSection: (...args) => apply(renameCategorySection, ...args),
    deleteSection: (...args) => apply(deleteCategorySection, ...args),
    moveCategory: (...args) => apply(moveCategory, ...args),
    moveSection: (...args) => apply(moveCategorySection, ...args),
    setCategoryAssets: (...args) => apply(setFolderAssets, ...args),
  };
  const source = collectionOpen ? assets.slice(4, 6) : assets;
  const retry = () => onScenarioChange('browse');
  const data = {
    ownerContext: 'design-system-library',
    assets: ['loading', 'empty', 'unavailable'].includes(scenario) ? [] : source,
    categories: library.folders,
    categoryOrganization: library.categoryOrganization,
    status: scenario === 'loading' ? 'loading' : scenario === 'unavailable' ? 'error' : 'ready',
    error: ['unavailable', 'retained'].includes(scenario)
      ? scenario === 'retained'
        ? 'Refresh unavailable. Previous example results are still shown.'
        : 'Assets could not be loaded.'
      : null,
    onRetry: retry,
    createdStatus: scenario === 'created-error' ? 'error' : 'ready',
    createdError: scenario === 'created-error' ? 'Example source unavailable' : null,
    createdRetained: scenario === 'created-error',
    onRetryCreated: retry,
    collectionContext: collectionOpen ? { name: 'Studio collection', total: 2, resolved: 2 } : null,
    onOpenCollection: () => setCollectionOpen(true),
    onCloseCollection: () => setCollectionOpen(false),
  };
  return (
    <div
      ref={root}
      className="ds-library-preview"
      hidden={!open}
      data-workflow-material="tactile"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <header className="ds-library-heading">
        <strong>Library</strong>
        <span>Local examples</span>
      </header>
      <LibraryWorkspace
        navigationHost={navigationHost}
        preferences={preferences}
        previewRecords={previewRecords}
        categoryCommands={categoryCommands}
        data={data}
        menuSurface={theme === 'mist' ? 'paper' : 'carbon'}
        onClose={onClose}
        phase={open ? 'open' : 'closed'}
        placementScope={scenario}
        placementTargetRef={placement}
        shortcutTargetRef={shortcut}
        workspaceRef={root}
      />
      <p className="ds-library-caption">
        Browse and organize example artwork. Placement and saving stay in the app.
      </p>
    </div>
  );
}
