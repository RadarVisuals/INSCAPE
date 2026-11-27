import { lazy, Suspense } from 'react';
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
  const modulePresentations = key => savedLayout?.[key] || [];

  return (
    <WorkbenchCanvasContent suspended={suspended}>
      {keeperRecords?.length > 0 && (
        <Suspense fallback={<span hidden data-artwork-module-pending />}>
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
        <Suspense fallback={<span hidden data-artwork-module-pending />}>
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
        <Suspense fallback={<p role="status" data-artwork-module-pending>Opening Image…</p>}>
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
        <Suspense fallback={<p role="status" data-artwork-module-pending>Opening Text…</p>}>
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
