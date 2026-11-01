import { useCallback, useMemo, useRef, useState } from 'react';
import { loadWorkbenchLayout } from './workbenchLayoutStorage.js';
import useWorkbenchLayoutPersistence from './useWorkbenchLayoutPersistence.js';
import { restoreSharedTools } from './sharedDisplayToolsState.js';
import { restoreTextToolsView } from '../../text/sharedTextToolsState.js';
import { createDefaultWorkbenchPresentation } from '../../profileDocument/domain/workbenchPresentation.js';
import { captureWorkbenchPresentation } from './workbenchPresentationCapture.js';

// Initialized once within the existing keyed Workbench lifetime. Restoring a
// backup discards the old layout cache; module and selection owners stay separate.
export function useWorkbenchLayoutSession({ profileAddress, draft, storage, workbenchId, restored }) {
  const [restoredWorkspace] = useState(() =>
    restored ? { layout: null, views: {} } : loadWorkbenchLayout(profileAddress, draft, storage, workbenchId)
  );
  const [sharedTools, setSharedTools] = useState(() => restoreSharedTools(restoredWorkspace.views));
  const [initialTextTools] = useState(() =>
    restoreTextToolsView(
      restoredWorkspace.views,
      draft.texts,
      restoredWorkspace.layout?.texts || draft.workbench?.texts
    )
  );
  const initialWorkbench = useRef(restoredWorkspace.layout || draft.workbench || null);
  const [workbenchLayout, setWorkbenchLayout] = useState(() => {
    const { area, ...layout } = initialWorkbench.current || createDefaultWorkbenchPresentation();
    return layout;
  });
  const changeIdentityWindow = useCallback(
    ({ left, top, width }) =>
      setWorkbenchLayout(current => {
        const window = { left, top, width };
        return JSON.stringify(window) === JSON.stringify(current.identity.window)
          ? current
          : { ...current, identity: { ...current.identity, window } };
      }),
    []
  );
  return {
    restoredWorkspace,
    initialWorkbench,
    workbenchLayout,
    changeIdentityWindow,
    sharedTools,
    setSharedTools,
    initialTextTools,
  };
}

// The same validated projection feeds Preview, publication, backup and switching.
// This hook never writes authored content; the existing cache owns persistence.
export default function useWorkbenchPresentation({
  profileAddress,
  draft,
  store,
  storage,
  workbenchId,
  layoutSession,
  modules,
  activeModuleId,
  identityOpen,
}) {
  const { restoredWorkspace, workbenchLayout, sharedTools } = layoutSession;
  const { views: textViews, presentations: textPresentations } = modules.text;
  const { records: instanceRecords, presentations: instancePresentations } = modules.display;
  const { presentations: miniAppPresentations } = modules.miniApps;
  const { presentations: imagePresentations } = modules.images;
  const { presentations: shapePresentations } = modules.shapes;
  const hasPrimaryDisplay = draft.grids.length > 0;
  const workbenchProjection = useMemo(
    () =>
      captureWorkbenchPresentation({
        layout: {
          ...workbenchLayout,
          ...(draft.workbench?.area ? { area: draft.workbench.area } : {}),
        },
        hasPrimaryDisplay,
        identityOpen,
        displays: draft.displays,
        miniApps: draft.miniApps,
        texts: draft.texts,
        displayPresentations: instancePresentations,
        miniAppPresentations,
        textPresentations,
        imageModules: draft.imageModules,
        imagePresentations,
        savedImagePresentations: draft.workbench?.imageModules,
        shapes: draft.shapes,
        shapePresentations,
        savedShapePresentations: draft.workbench?.shapes,
      }),
    [
      draft.workbench?.area,
      hasPrimaryDisplay,
      workbenchLayout,
      identityOpen,
      instancePresentations,
      draft.displays,
      draft.miniApps,
      miniAppPresentations,
      draft.texts,
      textPresentations,
      draft.imageModules,
      draft.workbench?.imageModules,
      imagePresentations,
      draft.shapes,
      draft.workbench?.shapes,
      shapePresentations,
    ]
  );
  const workbench = workbenchProjection.value;
  const workspaceViews = Object.fromEntries([
    ['workbench:tools', { ...sharedTools, targetId: activeModuleId }],
    ...Object.entries(instanceRecords).map(([id, record]) => [
      id,
      { gridId: record.controller.selectedGridId, locked: record.locked },
    ]),
    ...Object.entries(textViews),
  ]);
  const layoutPersistence = useWorkbenchLayoutPersistence({
    profile: profileAddress,
    draft,
    workbenchId,
    layout: workbench,
    views: workspaceViews,
    storage,
    initial: restoredWorkspace,
    canSave: store.hasWriteAccess,
  });
  return { projection: workbenchProjection, persistence: layoutPersistence };
}
