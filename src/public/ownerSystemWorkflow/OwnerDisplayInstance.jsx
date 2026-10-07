import { useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import DisplayModule from './DisplayModule.jsx';
import useOwnerSystemWorkflowController from './useOwnerSystemWorkflowController.js';
import { createNewDisplayPresentation } from '../../profileDocument/domain/workbenchPresentation.js';
import { PRIMARY_DISPLAY_ID } from '../../systemWorkflow/domain/displayModules.js';
import { captureDisplayPresentation, restoreDisplayPresentation } from './displayPresentation.js';
import { loadPresentationBoardShortcut } from './presentationBoardShortcutStorage.js';

export default function OwnerDisplayInstance({ id, index, store, profileAddress, initialPresentation, initialView, onLockChange, onController,
  onPresentation, onDelete, onActivate, active, shared }) {
  const controller = useOwnerSystemWorkflowController(profileAddress, { sharedStore: store, moduleId: id, initialGridId: initialView?.gridId });
  const displayRef = useRef(null);
  const placementRef = useRef(null);
  const shortcutRef = useRef(null);
  // Keep the original primary shortcut key and responsive first-open placement.
  const instanceId = id === PRIMARY_DISPLAY_ID ? undefined : id;
  const storedShortcut = useMemo(() => loadPresentationBoardShortcut(profileAddress, undefined, instanceId), []);
  const initial = useMemo(() => initialPresentation || { ...createNewDisplayPresentation(controller.draft.geometry, index),
    name: storedShortcut?.name || (index ? `DISPLAY ${index + 1}` : 'DISPLAY MODULE'), open: storedShortcut?.open !== false,
  }, []);
  const [presentation, setPresentation] = useState(initial);
  const [locked, setLocked] = useState(initialView?.locked || false);
  const initialWindow = useMemo(() => !instanceId && !initialPresentation ? undefined
    : !initialPresentation && storedShortcut ? { ...initial, shortcut: storedShortcut }
      : restoreDisplayPresentation(initial), []);
  const changeWindow = useCallback(change => setPresentation(current => {
    const next = { ...current, ...change };
    return JSON.stringify(next) === JSON.stringify(current) ? current : next;
  }), []);
  const [shortcutLayout, changeShortcut] = useState(null);
  const projectedPresentation = useMemo(() => captureDisplayPresentation(presentation, shortcutLayout, [...shared.assetsById.values()]),
    [presentation, shortcutLayout, shared.assetsById]);
  // The host's leave handler must see the state already shown in this paint.
  useLayoutEffect(() => { onPresentation(id, projectedPresentation); }, [id, projectedPresentation, onPresentation]);
  useLayoutEffect(() => { onController(id, { controller, displayRef, placementRef, shortcutRef, locked }); },
    [id, controller.generation, controller.selectedGridId, controller.selectedPlacementIds.join(','), controller.hiddenPlacementIds, controller.error, locked, onController]);
  useLayoutEffect(() => () => { onController(id, null); onPresentation(id, undefined); }, [id, onController, onPresentation]);
  return <div className="system-workflow__display-instance" data-display-instance={id} data-active-display={active || undefined}
    onPointerDownCapture={() => onActivate(id)} onFocusCapture={() => onActivate(id)}>
    <DisplayModule {...shared} displayName={presentation.name} ref={displayRef} controller={controller} placementTargetRef={placementRef} shortcutTargetRef={shortcutRef}
      authoringLocked={locked}
      onAuthoringLockToggle={() => { setLocked(!locked); onLockChange?.(!locked); }}
      windowProps={{ ...shared.windowProps, onDelete, profileAddress, instanceId, initialPresentation: initialWindow,
        instanceState: presentation.open ? 'window' : 'minimized', onWindowChange: changeWindow, onShortcutChange: changeShortcut,
        onMinimize: () => changeWindow({ open: false }), onRestore: () => changeWindow({ open: true }) }} />
  </div>;
}
