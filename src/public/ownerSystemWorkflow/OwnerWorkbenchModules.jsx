import { lazy, Suspense, useRef } from 'react';
import WorkbenchCanvasContent from './WorkbenchCanvasContent.jsx';

const TextWorkbench = lazy(() => import('../../text/TextWorkbench.jsx'));
const ImageWorkbench = lazy(() => import('../../imageModule/ImageWorkbench.jsx'));
const ShapeWorkbench = lazy(() => import('../../shapes/ShapeWorkbench.jsx'));
const KeeperWorkbench = lazy(() => import('../../keeper/KeeperWorkbench.jsx'));

// Concrete module mounts; content behavior stays in each existing module.
export default function OwnerWorkbenchModules({
  workbenchController,
  profileAddress,
  modules,
  initialWorkbench,
  restoredWorkspace,
  preferences: workbenchPreferences,
  selectionState,
  library,
  reducedMotion,
  workspaceRef,
  workbenchNavigationRef,
  keeperDockPositions,
  suspended,
  exiting,
}) {
  const { onPresentation: registerTextPresentation, onView: registerTextView } = modules.text;
  const { onPresentation: registerImagePresentation } = modules.images;
  const { onPresentation: registerShapePresentation } = modules.shapes;
  const { register: registerModuleAssetTarget } = modules.targets;
  const keeperRecords = workbenchController.store.keeper
    ? workbenchController.store.keeper.records()
    : workbenchController.draft.keeperDocks;
  const savedLayout = workbenchController.draft.workbench;
  const layoutAtEntry = useRef(savedLayout);
  const modulePresentations = key => {
    const saved = savedLayout?.[key] || [];
    // A restored Bento cell mounts again after Undo. Its current authored frame
    // supersedes the cached frame from when this editor session opened.
    if (workbenchController.store.getComposition && savedLayout !== layoutAtEntry.current) return saved;
    return [...(initialWorkbench.current?.[key] || []), ...saved];
  };

  return (
    <WorkbenchCanvasContent suspended={suspended}>
      {keeperRecords?.length > 0 && (
        <Suspense fallback={null}>
          <KeeperWorkbench
            navigationRef={workbenchNavigationRef}
            records={keeperRecords}
            store={workbenchController.store}
            profileAddress={profileAddress}
            hostRef={workspaceRef}
            dockPositions={keeperDockPositions}
            registerTarget={registerModuleAssetTarget}
            reducedMotion={reducedMotion}
            suspended={suspended}
            exiting={exiting}
          />
        </Suspense>
      )}
      {workbenchController.draft.shapes?.length > 0 && (
        <Suspense fallback={null}>
          <ShapeWorkbench
            records={workbenchController.draft.shapes}
            store={workbenchController.store}
            profileAddress={profileAddress}
            presentations={modulePresentations('shapes')}
            onPresentationChange={registerShapePresentation}
            onActivate={selectionState.focusModule}
            windowSnap={workbenchPreferences.shortcutSnap}
            suspended={suspended}
          />
        </Suspense>
      )}
      {workbenchController.draft.imageModules?.length > 0 && (
        <Suspense fallback={<p role="status">Opening Image…</p>}>
          <ImageWorkbench
            records={workbenchController.draft.imageModules}
            library={library}
            store={workbenchController.store}
            profileAddress={profileAddress}
            presentations={modulePresentations('imageModules')}
            onPresentationChange={registerImagePresentation}
            registerTarget={registerModuleAssetTarget}
            onActivate={selectionState.focusModule}
            suspended={suspended}
          />
        </Suspense>
      )}
      {workbenchController.draft.texts?.length > 0 && (
        <Suspense fallback={<p role="status">Opening Text…</p>}>
          <TextWorkbench
            views={restoredWorkspace.views}
            onViewChange={registerTextView}
            records={workbenchController.draft.texts}
            store={workbenchController.store}
            profileAddress={profileAddress}
            windowSnap={workbenchPreferences.shortcutSnap}
            presentations={modulePresentations('texts')}
            onPresentationChange={registerTextPresentation}
            registerTarget={registerModuleAssetTarget}
            suspended={suspended}
          />
        </Suspense>
      )}
    </WorkbenchCanvasContent>
  );
}
