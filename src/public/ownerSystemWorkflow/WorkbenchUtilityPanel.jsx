import { useLayoutEffect, useRef } from 'react';
import WorkbenchToolPanel from './WorkbenchToolPanel.jsx';

// Report actual screen geometry for companion settings and roaming origins.
export default function WorkbenchUtilityPanel({ onLayoutChange, ...props }) {
  const panel = useRef(null), current = useRef(onLayoutChange); current.current = onLayoutChange;
  useLayoutEffect(() => {
    const report = () => { const { left, top, width, height } = panel.current.getBoundingClientRect(); current.current?.({ left, top, width, height }); };
    const resize = new ResizeObserver(report), position = new MutationObserver(report);
    resize.observe(panel.current); position.observe(panel.current, { attributes: true, attributeFilter: ['style'] }); report();
    return () => { resize.disconnect(); position.disconnect(); };
  }, []);
  return <WorkbenchToolPanel {...props} panelRef={panel} />;
}
