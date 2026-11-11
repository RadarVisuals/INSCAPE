import { createContext, useCallback, useContext, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { DEFAULT_WORKBENCH_AREA, WORKBENCH_BOUNDS, WORKBENCH_EDITING_BOUNDS, workbenchArea, workbenchAreaBounds } from '../../systemWorkflow/domain/workbenchArea.js';

const Area = createContext({ area: DEFAULT_WORKBENCH_AREA, bounds: WORKBENCH_BOUNDS, editingBounds: WORKBENCH_EDITING_BOUNDS });
const noSubscribe = () => () => {};
const empty = Object.freeze({});
export const useWorkbenchArea = () => useContext(Area);

export function WorkbenchAreaProvider({ children, store, groupContent }) {
  const draft = useSyncExternalStore(store?.subscribe || noSubscribe, store?.getSnapshot || (() => groupContent || empty));
  const saved = useMemo(() => workbenchArea(draft.workbench), [draft.workbench]);
  const [outsideVisible, setOutsideVisible] = useState(false);
  const [canvasHost, setCanvasHost] = useState(null);
  // A drag preview is disposable and scoped to the exact draft it started on.
  const [preview, setPreview] = useState(null);
  const area = preview?.draft === draft ? preview.area : saved;
  const bounds = useMemo(() => workbenchAreaBounds(area), [area.left, area.top, area.width, area.height]);
  const latestDraft = useRef(draft); latestDraft.current = draft;
  const previewArea = useCallback(area => setPreview(area ? { area, draft: latestDraft.current } : null), []);
  const showOutside = Boolean(store) && outsideVisible;
  const value = useMemo(() => ({ area, bounds, editingBounds: WORKBENCH_EDITING_BOUNDS,
    showOutside, setShowOutside: setOutsideVisible, canvasHost, setCanvasHost, setPreview: previewArea }),
  [area, bounds, showOutside, canvasHost, previewArea]);
  return <Area.Provider value={value}>{children}</Area.Provider>;
}
