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

export function presentationPatchForCommand(command, presentation = {}) {
  if (command === 'presentation-transparent') return { background: 'transparent' };
  if (command === 'presentation-framed') return { background: presentation.background === 'transparent' ? 'dark' : presentation.background || 'dark' };
  if (command.startsWith('image-fit-')) return { fit: command.slice(10) };
  if (command.startsWith('frame-')) return { frame: command.slice(6) };
  if (command.startsWith('mat-')) return { mat: command.slice(4) };
  if (command.startsWith('background-')) return { background: command.slice(11) };
  return null;
}

export function contextMenuCommands({ target, editMode, launcher, canvasObject, canvasObjects = [], startOpen = false, menu = 'root', keeperVisible = true, stageVisible = true, stageAvailable = true, ownerAuthoringEnabled = false }) {
  if (!ownerAuthoringEnabled && target?.type === 'launcher') return [{ id: 'open', label: 'Open' }];
  if (!ownerAuthoringEnabled && target?.type === 'canvas-object') return [{ id: 'open-artwork', label: 'Open Artwork' }];
  if (target?.type === 'gallery-canvas') return ownerAuthoringEnabled
    ? [{ id: 'add-gallery-artwork', label: 'Add Artwork' },
      ...(canvasObjects.some((object) => !object.locked) ? [{ id: 'lock-all-artwork', label: 'Lock All Artwork' }] : []),
      ...(canvasObjects.some((object) => object.locked) ? [{ id: 'unlock-all-artwork', label: 'Unlock All Artwork' }] : [])]
    : [];
  if (target?.type === 'gallery-object' && !ownerAuthoringEnabled) return [{ id: 'open-artwork', label: 'Open Artwork' }];
  if (target?.type === 'canvas' && menu === 'view') return [
    { id: 'menu-root', label: '< Back' },
    { id: 'toggle-keeper', label: keeperVisible ? 'Hide Keeper' : 'Show Keeper' },
    ...(stageAvailable ? [{ id: 'toggle-stage', label: stageVisible ? 'Hide Stage' : 'Show Stage' }] : []),
    { id: 'toggle-grid', label: 'Toggle Grid' },
    { id: 'reset-home-camera', label: 'Return to Origin' }
  ];
  if (target?.type === 'canvas') return [
    ...(ownerAuthoringEnabled ? [{ id: 'toggle-edit', label: editMode ? 'Finish Arranging' : 'Arrange Desktop' }] : []),
    { id: 'menu-view', label: 'View >' },
    { id: 'reset-windows', label: 'Reset Windows' }, { id: 'close-all', label: 'Close All Windows' }
  ];
  if (target?.type === 'launcher') return [
    { id: 'open', label: 'Open' },
    ...(launcher?.viewType === 'folder' ? [{ id: 'rename-category', label: 'Rename Category' }] : []),
    ...(launcher && launcher.viewType !== 'folder' ? [{ id: 'toggle-visibility', label: launcher.visitorVisible ? 'Make Private' : 'Show to Visitors' }] : []),
    ...(launcher ? [{ id: 'unpin', label: launcher.viewType === 'folder' ? 'Remove Home Shortcut' : 'Unpin from Home' }] : [])
  ];
  if (['canvas-object', 'gallery-object'].includes(target?.type) && menu === 'layer') return [
    { id: 'menu-root', label: '< Back' }, { id: 'object-forward', label: 'Bring Forward' }, { id: 'object-backward', label: 'Send Backward' },
    { id: 'object-front', label: 'Bring to Front' }, { id: 'object-back', label: 'Send to Back' }
  ];
  if (target?.type === 'gallery-object' && menu === 'appearance') return [
    { id: 'menu-root', label: '< Back' },
    { id: 'menu-presentation', label: 'Presentation >' },
    { id: 'menu-image-fit', label: 'Image Fit >' },
    { id: 'menu-frame', label: 'Frame >' },
    { id: 'menu-mat', label: 'Mat >' },
    { id: 'menu-background', label: 'Background >' }
  ];
  if (target?.type === 'gallery-object' && menu === 'presentation') return [
    { id: 'menu-appearance', label: '< Back' },
    { id: 'presentation-transparent', label: `${canvasObject?.presentation?.background === 'transparent' ? '✓ ' : ''}Transparent` },
    { id: 'presentation-framed', label: `${canvasObject?.presentation?.background !== 'transparent' ? '✓ ' : ''}Framed` }
  ];
  if (target?.type === 'gallery-object' && menu === 'image-fit') return [
    { id: 'menu-appearance', label: '< Back' },
    { id: 'image-fit-contain', label: `${canvasObject?.presentation?.fit === 'contain' ? '✓ ' : ''}Contain` },
    { id: 'image-fit-cover', label: `${canvasObject?.presentation?.fit === 'cover' ? '✓ ' : ''}Cover` }
  ];
  if (target?.type === 'gallery-object' && menu === 'frame') return [
    { id: 'menu-appearance', label: '< Back' },
    ...['none', 'thin', 'heavy'].map((value) => ({ id: `frame-${value}`, label: `${canvasObject?.presentation?.frame === value ? '✓ ' : ''}${value[0].toUpperCase()}${value.slice(1)}` }))
  ];
  if (target?.type === 'gallery-object' && menu === 'mat') return [
    { id: 'menu-appearance', label: '< Back' },
    ...['none', 'light', 'dark'].map((value) => ({ id: `mat-${value}`, label: `${canvasObject?.presentation?.mat === value ? '✓ ' : ''}${value[0].toUpperCase()}${value.slice(1)}` }))
  ];
  if (target?.type === 'gallery-object' && menu === 'background') return [
    { id: 'menu-appearance', label: '< Back' },
    ...['dark', 'light', 'neutral'].map((value) => ({ id: `background-${value}`, label: `${canvasObject?.presentation?.background === value ? '✓ ' : ''}${value[0].toUpperCase()}${value.slice(1)}` }))
  ];
  if (target?.type === 'canvas-object') return [
    { id: 'open-artwork', label: 'Open Artwork' }, { id: 'edit-artwork', label: 'Edit Artwork' }, { id: 'replace-artwork', label: 'Replace Artwork' },
    { id: 'toggle-object-visibility', label: canvasObject?.visitorVisible ? 'Make Private' : 'Show to Visitors' },
    { id: 'menu-layer', label: 'Layer >' }, { id: 'remove-artwork', label: 'Remove from Canvas' }
  ];
  if (target?.type === 'gallery-object') return [
    { id: 'open-artwork', label: 'Open Artwork' },
    { id: 'menu-appearance', label: 'Appearance >' },
    { id: 'replace-artwork', label: 'Replace Artwork' },
    { id: 'remove-artwork', label: 'Remove from Gallery' },
    { id: 'menu-layer', label: 'Layer >' },
    { id: 'toggle-object-visibility', label: canvasObject?.visitorVisible ? 'Make Private' : 'Make Public' },
    { id: 'toggle-artwork-lock', label: canvasObject?.locked ? 'Unlock' : 'Lock' }
  ];
  if (target?.type === 'window') return [
    { id: 'close', label: 'Close' }, { id: 'reset-window', label: 'Reset Position and Size' },
    ...(ownerAuthoringEnabled ? [{ id: 'toggle-start-open', label: startOpen ? 'Remove from Visitor Start Layout' : 'Set as Visitor Start Window' }] : [])
  ];
  return [];
}
