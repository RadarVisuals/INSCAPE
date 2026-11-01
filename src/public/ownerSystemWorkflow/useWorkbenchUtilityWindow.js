import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkbenchView } from './WorkbenchViewContext.js';

// Navigator and Keeper share only screen slots. Their content and movement
// remain independent. Manual positions are retained by the profile session.
export default function useWorkbenchUtilityWindow(slot, saved, onSave) {
  const view = useWorkbenchView();
  const [viewport, setViewport] = useState(() => ({ width: innerWidth, height: innerHeight }));
  const [touch, setTouch] = useState(() => matchMedia('(max-width: 520px), (pointer: coarse)').matches);
  const [manual, setManual] = useState(saved || null);
  const current = useRef(onSave); current.current = onSave;
  useEffect(() => {
    const media = matchMedia('(max-width: 520px), (pointer: coarse)');
    const resize = () => { setViewport({ width: innerWidth, height: innerHeight }); setTouch(media.matches); };
    addEventListener('resize', resize); media.addEventListener('change', resize);
    return () => { removeEventListener('resize', resize); media.removeEventListener('change', resize); };
  }, []);
  const width = view.miniatures ? Math.min(176, (viewport.width - 44) / 2) : 176;
  const bottom = view.toolViewportBottom ?? viewport.height - 48;
  const minimumTop = Math.max(68, view.navigationTop ?? 0);
  const naturalHeight = view.miniatures ? Math.max(72, Math.min(touch ? 228 : 188, bottom - minimumTop - 8)) : 188;
  // On a short screen, keep settings above both utilities. Their own content
  // scrolls within the temporarily shorter windows; closing restores the size.
  const height = view.utilitySettings?.size && viewport.width < 700 ? Math.max(72, Math.min(naturalHeight, (view.toolViewportBottom ?? viewport.height - 48) - minimumTop - 16 - 140)) : naturalHeight;
  const columns = Math.max(2, Math.floor((viewport.width - 20) / (width + 12)));
  const frame = useMemo(() => ({ left: manual?.left ?? Math.max(8, viewport.width - 16 - width - slot % columns * (width + 12)),
    top: manual?.top ?? Math.max(8, (view.toolViewportBottom ?? viewport.height - 48) - 8 - height - Math.floor(slot / columns) * (height + 12)), width, height }),
  [manual, viewport.width, viewport.height, view.toolViewportBottom, width, height, slot, columns]);
  const commit = useCallback(frame => { const position = { left: frame.left, top: frame.top }; setManual(position); current.current?.(position); }, []);
  return { frame, commit };
}
