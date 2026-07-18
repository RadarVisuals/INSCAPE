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
  const launcher = target.closest?.('[data-launcher-id]');
  if (launcher && desktop.contains(launcher)) return { type: 'launcher', id: launcher.dataset.launcherId };
  if (target.closest?.('.module-shell--expanded')) return null;
  if (target.closest?.('[data-desktop-canvas]')) return { type: 'canvas', id: 'canvas' };
  return null;
}

export function contextMenuCommands({ target, editMode, launcher, startOpen = false, menu = 'root', keeperVisible = true, stageVisible = true }) {
  if (target?.type === 'canvas' && menu === 'create') return [
    { id: 'menu-root', label: '< Back' }, { id: 'create-folder', label: 'Folder' }
  ];
  if (target?.type === 'canvas' && menu === 'view') return [
    { id: 'menu-root', label: '< Back' },
    { id: 'toggle-keeper', label: keeperVisible ? 'Hide Keeper' : 'Show Keeper' },
    { id: 'toggle-stage', label: stageVisible ? 'Hide Stage' : 'Show Stage' },
    { id: 'toggle-grid', label: 'Toggle Grid' }
  ];
  if (target?.type === 'canvas') return [
    { id: 'toggle-edit', label: editMode ? 'Finish Arranging' : 'Arrange Desktop' },
    { id: 'menu-create', label: 'Create >' }, { id: 'menu-view', label: 'View >' },
    { id: 'reset-windows', label: 'Reset Windows' }, { id: 'close-all', label: 'Close All Windows' },
    { id: 'settings', label: 'Settings' }
  ];
  if (target?.type === 'launcher') return [
    { id: 'open', label: 'Open' },
    { id: 'edit-launcher', label: 'Edit Launcher' },
    ...(launcher ? [
      { id: 'toggle-visibility', label: launcher.visitorVisible ? 'Make Private' : 'Show to Visitors' },
      { id: 'unpin', label: 'Unpin from Canvas' }
    ] : [])
  ];
  if (target?.type === 'window') return [
    { id: 'close', label: 'Close' }, { id: 'reset-window', label: 'Reset Position and Size' },
    { id: 'toggle-start-open', label: startOpen ? 'Remove from Visitor Start Layout' : 'Set as Visitor Start Window' }
  ];
  return [];
}
