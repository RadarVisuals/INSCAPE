export function clampMenuPosition(point, menuSize, viewport, margin = 8) {
  const width = Math.max(0, Number(menuSize?.width) || 0);
  const height = Math.max(0, Number(menuSize?.height) || 0);
  return {
    x: Math.max(margin, Math.min(Number(point?.x) || 0, Math.max(margin, viewport.width - width - margin))),
    y: Math.max(margin, Math.min(Number(point?.y) || 0, Math.max(margin, viewport.height - height - margin)))
  };
}

export function resolveContextTarget(target, desktop) {
  if (!target || !desktop?.contains(target)) return null;
  const title = target.closest?.('[data-window-titlebar]');
  if (title && desktop.contains(title)) return { type: 'window', id: title.dataset.windowTitlebar };
  const canvasObject = target.closest?.('[data-canvas-object-id]');
  if (canvasObject && desktop.contains(canvasObject)) return { type: 'canvas-object', id: canvasObject.dataset.canvasObjectId };
  const launcher = target.closest?.('[data-launcher-id]');
  if (launcher && desktop.contains(launcher)) return { type: 'launcher', id: launcher.dataset.launcherId };
  if (target.closest?.('.module-shell--expanded')) return null;
  if (target.closest?.('[data-desktop-canvas]')) return { type: 'canvas', id: 'canvas' };
  return null;
}

export function contextMenuCommands({ target, editMode, launcher, canvasObject, startOpen = false, menu = 'root', keeperVisible = true, stageVisible = true, stageAvailable = true, ownerAuthoringEnabled = false }) {
  if (!ownerAuthoringEnabled && target?.type === 'launcher') return [{ id: 'open', label: 'Open' }];
  if (!ownerAuthoringEnabled && target?.type === 'canvas-object') return [{ id: 'open-artwork', label: 'Open Artwork' }];
  if (target?.type === 'canvas' && menu === 'create') return [
    { id: 'menu-root', label: '< Back' }, { id: 'create-folder', label: 'Folder' }, { id: 'create-framed-artwork', label: 'Framed Artwork' }
  ];
  if (target?.type === 'canvas' && menu === 'view') return [
    { id: 'menu-root', label: '< Back' },
    { id: 'toggle-keeper', label: keeperVisible ? 'Hide Keeper' : 'Show Keeper' },
    ...(stageAvailable ? [{ id: 'toggle-stage', label: stageVisible ? 'Hide Stage' : 'Show Stage' }] : []),
    { id: 'toggle-grid', label: 'Toggle Grid' },
    { id: 'reset-home-camera', label: 'Return to Origin' }
  ];
  if (target?.type === 'canvas') return [
    ...(ownerAuthoringEnabled ? [{ id: 'toggle-edit', label: editMode ? 'Finish Arranging' : 'Arrange Desktop' }, { id: 'menu-create', label: 'Create >' }] : []),
    { id: 'menu-view', label: 'View >' },
    { id: 'reset-windows', label: 'Reset Windows' }, { id: 'close-all', label: 'Close All Windows' },
    ...(ownerAuthoringEnabled ? [{ id: 'settings', label: 'Settings' }] : [])
  ];
  if (target?.type === 'launcher') return [
    { id: 'open', label: 'Open' },
    { id: 'edit-launcher', label: 'Edit Launcher' },
    ...(launcher && launcher.viewType !== 'folder' ? [
      { id: 'toggle-visibility', label: launcher.visitorVisible ? 'Make Private' : 'Show to Visitors' },
      { id: 'unpin', label: 'Unpin from Canvas' }
    ] : [])
  ];
  if (target?.type === 'canvas-object' && menu === 'layer') return [
    { id: 'menu-root', label: '< Back' }, { id: 'object-forward', label: 'Bring Forward' }, { id: 'object-backward', label: 'Send Backward' },
    { id: 'object-front', label: 'Bring to Front' }, { id: 'object-back', label: 'Send to Back' }
  ];
  if (target?.type === 'canvas-object') return [
    { id: 'open-artwork', label: 'Open Artwork' }, { id: 'edit-artwork', label: 'Edit Artwork' }, { id: 'replace-artwork', label: 'Replace Artwork' },
    { id: 'toggle-object-visibility', label: canvasObject?.visitorVisible ? 'Make Private' : 'Show to Visitors' },
    { id: 'menu-layer', label: 'Layer >' }, { id: 'remove-artwork', label: 'Remove from Canvas' }
  ];
  if (target?.type === 'window') return [
    { id: 'close', label: 'Close' }, { id: 'reset-window', label: launcher ? 'Reset Near Folder' : 'Reset Position and Size' },
    ...(ownerAuthoringEnabled && launcher?.viewType !== 'folder' ? [{ id: 'toggle-start-open', label: startOpen ? 'Remove from Visitor Start Layout' : 'Set as Visitor Start Window' }] : [])
  ];
  return [];
}
