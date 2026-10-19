import { createContext, useCallback, useContext, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { DEFAULT_WORKBENCH_AREA, WORKBENCH_BOUNDS, workbenchArea, workbenchAreaBounds } from '../../systemWorkflow/domain/workbenchArea.js';

const Area = createContext({ area: DEFAULT_WORKBENCH_AREA, bounds: WORKBENCH_BOUNDS });
const noSubscribe = () => () => {};
const empty = Object.freeze({});
export const useWorkbenchArea = () => useContext(Area);

export function WorkbenchAreaProvider({ children, store, groupContent }) {
  const draft = useSyncExternalStore(store?.subscribe || noSubscribe, store?.getSnapshot || (() => groupContent || empty));
  const saved = workbenchArea(draft.workbench);
  // A drag preview is disposable and scoped to the exact draft it started on.
  const [preview, setPreview] = useState(null);
  const area = preview?.draft === draft ? preview.area : saved;
  const bounds = useMemo(() => workbenchAreaBounds(area), [area.width, area.height]);
  const latestDraft = useRef(draft); latestDraft.current = draft;
  const previewArea = useCallback(area => setPreview(area ? { area, draft: latestDraft.current } : null), []);
  const value = useMemo(() => ({ area, bounds, setPreview: previewArea }), [area, bounds, previewArea]);
  return <Area.Provider value={value}>{children}</Area.Provider>;
}
