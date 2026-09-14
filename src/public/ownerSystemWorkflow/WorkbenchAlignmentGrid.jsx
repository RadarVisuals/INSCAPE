import { useEffect, useState } from 'react';
import LatticePixelGrid from '../../lattice/rendering/LatticePixelGrid.jsx';

const field = { cellSize: 24, left: 0, top: 0 };
export default function WorkbenchAlignmentGrid({ hostRef, color, mode }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => setSize({ width: host.clientWidth, height: host.clientHeight });
    measure();
    const observer = new ResizeObserver(measure); observer.observe(host);
    return () => observer.disconnect();
  }, [hostRef]);
  return <LatticePixelGrid color={color || 'var(--study-grid)'} field={field}
    guideInterval={1} guideSize={1} mode={mode} {...size} />;
}
