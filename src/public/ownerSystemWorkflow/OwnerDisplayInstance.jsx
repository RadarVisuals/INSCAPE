import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import DisplayModule from './DisplayModule.jsx';
import useOwnerSystemWorkflowController from './useOwnerSystemWorkflowController.js';
import { createNewDisplayPresentation } from '../../profileDocument/domain/workbenchPresentation.js';
import { createProfileDocumentV9AssetResolver } from '../../profileDocument/domain/profileDocumentV9Asset.js';
import { loadPresentationBoardShortcut } from './presentationBoardShortcutStorage.js';

export default function OwnerDisplayInstance({ id, index, store, profileAddress, initialPresentation, initialView, onController,
  onPresentation, onDelete, onActivate, active, shared }) {
  const controller = useOwnerSystemWorkflowController(profileAddress, { sharedStore: store, moduleId: id, initialGridId: initialView?.gridId });
  const displayRef = useRef(null);
  const placementRef = useRef(null);
  const shortcutRef = useRef(null);
  const storedShortcut = useMemo(() => loadPresentationBoardShortcut(profileAddress, undefined, id), []);
  const initial = useMemo(() => initialPresentation || { ...createNewDisplayPresentation(controller.draft.geometry.rows > controller.draft.geometry.columns ? 'PORTRAIT' : 'LANDSCAPE', index),
    name: storedShortcut?.name || `DISPLAY ${index + 1}`, open: storedShortcut?.open !== false,
  }, []);
  const [presentation, setPresentation] = useState(initial);
  const [locked, setLocked] = useState(initialView?.locked || false);
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
  useEffect(() => { onController(id, { controller, displayRef, placementRef, shortcutRef, locked }); },
    [id, controller.generation, controller.selectedGridId, controller.selectedPlacementIds.join(','), controller.hiddenPlacementIds, controller.error, locked, onController]);
  useEffect(() => () => { onController(id, null); onPresentation(id, undefined); }, [id, onController, onPresentation]);
  return <div className="system-workflow__display-instance" data-display-instance={id} data-active-display={active || undefined}
    onPointerDownCapture={() => onActivate(id)} onFocusCapture={() => onActivate(id)}>
    <DisplayModule {...shared} displayName={presentation.name} ref={displayRef} controller={controller} placementTargetRef={placementRef} shortcutTargetRef={shortcutRef}
      authoringLocked={locked}
      onAuthoringLockToggle={() => setLocked(current => !current)}
      windowProps={{ ...shared.windowProps, onDelete, profileAddress, instanceId: id, initialPresentation: initialWindow,
        instanceState: presentation.open ? 'window' : 'minimized', onWindowChange: changeWindow, onShortcutChange: changeShortcut,
        onMinimize: () => changeWindow({ open: false }), onRestore: () => changeWindow({ open: true }) }} />
  </div>;
}
