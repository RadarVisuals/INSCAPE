import { useCallback, useRef, useState } from 'react';

// Temporary module reports, not authored content or a second selection owner.
// The keyed Workbench session discards every registration on activation changes.
export default function useWorkbenchModuleRegistry({ displayIds, selectedDisplayId }) {
  const [textViews, registerTextView] = useModuleReports();
  const [instanceRecords, registerController] = useModuleReports();
  const [instancePresentations, registerPresentation] = useModuleReports(true);
  const [miniAppPresentations, registerMiniAppPresentation] = useModuleReports();
  const [textPresentations, registerTextPresentation] = useModuleReports();
  const [imagePresentations, registerImagePresentation] = useModuleReports();
  const [shapePresentations, registerShapePresentation] = useModuleReports();
  const selectedInstance = instanceRecords[selectedDisplayId];
  // Resolve live refs at the time of the query, never cache a detached target.
  const displayTargets = field =>
    displayIds
      .map(id => instanceRecords[id]?.[field])
      .filter(Boolean)
      .map(ref => ref.current);
  const allPlacementTargetsRef = useRef(null);
  const allShortcutTargetsRef = useRef(null);
  allPlacementTargetsRef.current = {
    // Async Library activation retains the concrete Display/Grid it started on.
    captureTarget: () => selectedInstance?.placementRef.current,
    targetAt: point => {
      const hit = document.elementFromPoint(point.x, point.y);
      return displayTargets('placementRef').find(target => target?.isCurrent() && target.node?.contains(hit));
    },
    textTargets: () =>
      displayTargets('placementRef').filter(target => target?.isCurrent() && target.previewTextAt),
    previewTextAt: (point, rectangle) => {
      for (const target of displayTargets('placementRef')) {
        const preview = target?.previewTextAt?.(point, rectangle);
        if (preview) return { ...preview, target };
      }
      return null;
    },
  };
  allShortcutTargetsRef.current = {
    targetAt: point =>
      displayTargets('shortcutRef').find(target =>
        target?.node?.contains(document.elementFromPoint(point.x, point.y))
      ),
    has: target => displayTargets('shortcutRef').some(current => current === target),
  };
  const identityTargetRef = useRef(null);
  const moduleAssetTargets = useRef(new Map());
  const registerModuleAssetTarget = useCallback((id, target) => {
    if (target) moduleAssetTargets.current.set(id, target);
    else moduleAssetTargets.current.delete(id);
  }, []);
  const moduleTargetsRef = useRef(null);
  if (!moduleTargetsRef.current)
    moduleTargetsRef.current = {
      targetAt(point) {
        const hit = document.elementFromPoint(point.x, point.y);
        return [identityTargetRef.current, ...moduleAssetTargets.current.values()].find(target =>
          target?.node?.contains(hit)
        );
      },
      has(target) {
        return (
          identityTargetRef.current === target || [...moduleAssetTargets.current.values()].includes(target)
        );
      },
    };
  return {
    display: {
      records: instanceRecords,
      presentations: instancePresentations,
      onController: registerController,
      onPresentation: registerPresentation,
      selected: selectedInstance,
    },
    text: {
      views: textViews,
      onView: registerTextView,
      presentations: textPresentations,
      onPresentation: registerTextPresentation,
    },
    miniApps: { presentations: miniAppPresentations, onPresentation: registerMiniAppPresentation },
    images: { presentations: imagePresentations, onPresentation: registerImagePresentation },
    shapes: { presentations: shapePresentations, onPresentation: registerShapePresentation },
    targets: {
      placement: allPlacementTargetsRef,
      shortcut: allShortcutTargetsRef,
      identity: identityTargetRef,
      module: moduleTargetsRef,
      register: registerModuleAssetTarget,
    },
  };
}

// Display reports use undefined to unregister and retain null as a real report.
// The other module reports unregister on a falsy value, as their existing APIs do.
function useModuleReports(keepNull = false) {
  const [reports, setReports] = useState({});
  const register = useCallback(
    (id, value) =>
      setReports(current => {
        const next = { ...current };
        if (keepNull ? value !== undefined : Boolean(value)) next[id] = value;
        else delete next[id];
        return next;
      }),
    [keepNull]
  );
  return [reports, register];
}
