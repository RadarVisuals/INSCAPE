import { lazy, Suspense, useRef } from 'react';
import WorkbenchCanvasContent from './WorkbenchCanvasContent.jsx';
import OwnerDisplayInstance from './OwnerDisplayInstance.jsx';

import { PRIMARY_DISPLAY_ID, displayModuleIds } from '../../systemWorkflow/domain/displayModules.js';
import { latticeSurfaceColor } from '../../lattice/rendering/latticeGeometry.js';
const MiniAppsWorkbench = lazy(() => import('../../miniApps/MiniAppsWorkbench.jsx'));
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
  onPreferencesChange: setWorkbenchPreferences,
  selectionState,
  library,
  layout,
  workspaceRef,
  workbenchNavigationRef,
  keeperDockPositions,
  preview,
  panelOccupied,
  instrumentsObscured,
  revealInstruments,
  toggleLibrary,
  panels,
  deleteDisplay,
  onConnect,
}) {
  const { onController: registerController, onPresentation: registerPresentation } = modules.display;
  const { onPresentation: registerMiniAppPresentation } = modules.miniApps;
  const { onPresentation: registerTextPresentation, onView: registerTextView } = modules.text;
  const { onPresentation: registerImagePresentation } = modules.images;
  const { onPresentation: registerShapePresentation } = modules.shapes;
  const { register: registerModuleAssetTarget, placement: allPlacementTargetsRef } = modules.targets;
  const { assetsById, registerAssetDimensions, resolveAssetDimensions } = library;
  const displayIds = displayModuleIds(workbenchController.draft);
  const activeModuleId = selectionState.targetId;
  const menuSurface = workbenchController.draft?.appearance.menuSurfaceId;
  const workspaceSurfaceColor = latticeSurfaceColor(workbenchPreferences.surfaceId);
  const initialPrimary = useRef(true);
  if (!workbenchController.draft.grids.length) initialPrimary.current = false;
  return (
    <>
      <WorkbenchCanvasContent>
        {displayIds.map(id => (
          <OwnerDisplayInstance
            key={id}
            id={id}
            index={
              id === PRIMARY_DISPLAY_ID
                ? 0
                : workbenchController.draft.displays.findIndex(module => module.id === id) + 1
            }
            initialView={{
              ...(id === PRIMARY_DISPLAY_ID ? { locked: workbenchPreferences.compositionLocked } : {}),
              ...restoredWorkspace.views[id],
            }}
            onLockChange={
              id === PRIMARY_DISPLAY_ID
                ? locked =>
                    setWorkbenchPreferences(current => ({
                      ...current,
                      compositionLocked: locked,
                    }))
                : undefined
            }
            onDelete={() =>
              deleteDisplay(
                id === PRIMARY_DISPLAY_ID
                  ? { id, grids: workbenchController.draft.grids }
                  : workbenchController.draft.displays.find(module => module.id === id)
              )
            }
            store={workbenchController.store}
            profileAddress={profileAddress}
            initialPresentation={
              id === PRIMARY_DISPLAY_ID
                ? initialPrimary.current
                  ? initialWorkbench.current?.display
                  : workbenchController.draft.workbench?.display
                : initialWorkbench.current?.displays?.find(item => item.id === id) ||
                  workbenchController.draft.workbench?.displays?.find(item => item.id === id)
            }
            active={activeModuleId === id}
            onActivate={selectionState.focusModule}
            onController={registerController}
            onPresentation={registerPresentation}
            shared={{
              assetsById,
              suspended: Boolean(preview),
              panelOccupied,
              instrumentsObscured,
              onRevealInstruments: revealInstruments,
              onToggleLibrary: toggleLibrary,
              onInspect: () => {
                if (!panels.isPanelOpen('library')) panels.closePanel({ returnFocus: false });
              },
              registerAssetDimensions,
              resolveAssetDimensions,
              menuSurface,
              reducedMotion: layout.reducedMotion,
              workspaceSurfaceColor,
              windowProps: {
                layoutMode: layout.mode,
                reducedMotion: layout.reducedMotion,
                shortcutSnap: workbenchPreferences.shortcutSnap,
                windowSnap: workbenchPreferences.shortcutSnap,
              },
            }}
          />
        ))}
        {workbenchController.draft.keeperDocks?.length > 0 && (
          <Suspense fallback={null}>
            <KeeperWorkbench
              navigationRef={workbenchNavigationRef}
              records={workbenchController.draft.keeperDocks}
              store={workbenchController.store}
              profileAddress={profileAddress}
              hostRef={workspaceRef}
              dockPositions={keeperDockPositions}
              registerTarget={registerModuleAssetTarget}
              reducedMotion={layout.reducedMotion}
              suspended={Boolean(preview)}
            />
          </Suspense>
        )}
        {workbenchController.draft.shapes?.length > 0 && (
          <Suspense fallback={null}>
            <ShapeWorkbench
              records={workbenchController.draft.shapes}
              store={workbenchController.store}
              profileAddress={profileAddress}
              presentations={[
                ...(initialWorkbench.current?.shapes || []),
                ...(workbenchController.draft.workbench?.shapes || []),
              ]}
              onPresentationChange={registerShapePresentation}
              onActivate={selectionState.focusModule}
              windowSnap={workbenchPreferences.shortcutSnap}
              suspended={Boolean(preview)}
            />
          </Suspense>
        )}
        {workbenchController.draft.imageModules?.length > 0 && (
          <Suspense fallback={<p role="status">Opening Image…</p>}>
            <ImageWorkbench
              records={workbenchController.draft.imageModules}
              store={workbenchController.store}
              profileAddress={profileAddress}
              presentations={[
                ...(initialWorkbench.current?.imageModules || []),
                ...(workbenchController.draft.workbench?.imageModules || []),
              ]}
              onPresentationChange={registerImagePresentation}
              registerTarget={registerModuleAssetTarget}
              onActivate={selectionState.focusModule}
              suspended={Boolean(preview)}
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
              presentations={[
                ...(initialWorkbench.current?.texts || []),
                ...(workbenchController.draft.workbench?.texts || []),
              ]}
              onPresentationChange={registerTextPresentation}
              registerTarget={registerModuleAssetTarget}
              placementTargets={allPlacementTargetsRef}
              suspended={Boolean(preview)}
            />
          </Suspense>
        )}
      </WorkbenchCanvasContent>
      {workbenchController.draft.miniApps?.length > 0 && (
        <Suspense fallback={<p role="status">Opening mini apps…</p>}>
          <MiniAppsWorkbench
            records={workbenchController.draft.miniApps}
            store={workbenchController.store}
            profileAddress={profileAddress}
            presentations={initialWorkbench.current?.miniApps}
            onPresentationChange={registerMiniAppPresentation}
            onConnect={onConnect}
            suspended={Boolean(preview)}
          />
        </Suspense>
      )}
    </>
  );
}
