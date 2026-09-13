import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import DisplayModule from './DisplayModule.jsx';
import useOwnerSystemWorkflowController from './useOwnerSystemWorkflowController.js';
import { createDefaultWorkbenchPresentation } from '../../profileDocument/domain/workbenchPresentation.js';
import { createProfileDocumentV9AssetResolver } from '../../profileDocument/domain/profileDocumentV9Asset.js';
import { loadPresentationBoardShortcut } from './presentationBoardShortcutStorage.js';

export default function OwnerDisplayInstance({ id, index, store, profileAddress, initialPresentation, onController,
  onPresentation, onActivate, onContextMenu, active, shared }) {
  const controller = useOwnerSystemWorkflowController(profileAddress, { sharedStore: store, moduleId: id });
  const displayRef = useRef(null);
  const placementRef = useRef(null);
  const shortcutRef = useRef(null);
  const storedShortcut = useMemo(() => loadPresentationBoardShortcut(profileAddress, undefined, id), []);
  const initial = useMemo(() => initialPresentation || { ...createDefaultWorkbenchPresentation().display,
    name: storedShortcut?.name || `DISPLAY ${index + 1}`, open: storedShortcut?.open !== false,
    window: { left: 72 + index * 32, top: 64 + index * 32, width: 560, height: 353 },
    shortcut: { ...createDefaultWorkbenchPresentation().display.shortcut, position: { left: 24 + index * 96, top: 72 } } }, []);
  const [presentation, setPresentation] = useState(initial);
  const [locked, setLocked] = useState(false);
  const [metadataAvailable, setMetadataAvailable] = useState(false);
  const initialWindow = useMemo(() => ({ ...initial, shortcut: !initialPresentation && storedShortcut ? storedShortcut : { ...initial.shortcut, open: initial.open,
    iconAssetId: initial.shortcut.icon?.stableAssetId || null,
    iconMedia: initial.shortcut.icon?.media || null } }), []);
  const changeWindow = useCallback(change => setPresentation(current => ({ ...current, ...change })), []);
  const [shortcutLayout, changeShortcut] = useState(null);
  const projectedPresentation = useMemo(() => {
    if (!shortcutLayout) return presentation;
    try {
      const shortcut = shortcutLayout;
      const existing = presentation.shortcut.icon;
      const icon = !shortcut.iconAssetId ? null : existing?.stableAssetId === shortcut.iconAssetId
        && (!shortcut.iconMedia || shortcut.iconMedia.url === existing.media.url) ? existing
          : createProfileDocumentV9AssetResolver([...shared.assetsById.values()], { compactContentReference: false })(shortcut.iconAssetId, shortcut.iconMedia);
      return { ...presentation, shortcut: { position: shortcut.position, visible: shortcut.visible, icon, iconPresentation: shortcut.iconPresentation } };
    } catch { return null; }
  }, [presentation, shortcutLayout, shared.assetsById]);
  useEffect(() => { onPresentation(id, projectedPresentation); }, [id, projectedPresentation, onPresentation]);
  useEffect(() => { onController(id, { controller, displayRef, placementRef, shortcutRef, locked, metadataAvailable }); },
    [id, controller.generation, controller.selectedGridId, controller.selectedPlacementIds.join(','), controller.hiddenPlacementIds, controller.error, locked, metadataAvailable, onController]);
  return <div className="system-workflow__display-instance" data-display-instance={id} data-active-display={active || undefined}
    onPointerDownCapture={() => onActivate(id)} onFocusCapture={() => onActivate(id)}>
    <DisplayModule {...shared} ref={displayRef} controller={controller} placementTargetRef={placementRef} shortcutTargetRef={shortcutRef}
      authoringLocked={locked} active={presentation.open && !shared.panelOccupied}
      onAuthoringLockToggle={() => setLocked(current => !current)} onMetadataAvailabilityChange={setMetadataAvailable}
      windowProps={{ ...shared.windowProps, profileAddress, instanceId: id, initialPresentation: initialWindow,
        instanceState: presentation.open ? 'window' : 'minimized', onWindowChange: changeWindow, onShortcutChange: changeShortcut,
        onMinimize: () => changeWindow({ open: false }), onRestore: () => changeWindow({ open: true }),
        onContextMenu: event => onContextMenu(event, id) }} />
  </div>;
}
