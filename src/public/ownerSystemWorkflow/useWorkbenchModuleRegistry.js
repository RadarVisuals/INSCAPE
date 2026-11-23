import { useCallback, useRef, useState } from 'react';

// Temporary module reports, not authored content or a second selection owner.
// The keyed Workbench session discards every registration on activation changes.
export default function useWorkbenchModuleRegistry() {
  const [textViews, registerTextView] = useModuleReports();
  const [miniAppPresentations, registerMiniAppPresentation] = useModuleReports();
  const [textPresentations, registerTextPresentation] = useModuleReports();
  const [imagePresentations, registerImagePresentation] = useModuleReports();
  const [shapePresentations, registerShapePresentation] = useModuleReports();
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
      identity: identityTargetRef,
      module: moduleTargetsRef,
      register: registerModuleAssetTarget,
    },
  };
}

function useModuleReports() {
  const [reports, setReports] = useState({});
  const register = useCallback(
    (id, value) =>
      setReports(current => {
        const next = { ...current };
        if (value) next[id] = value;
        else delete next[id];
        return next;
      }),
    []
  );
  return [reports, register];
}
