import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import './workbenchSnapGuides.css';

export default function WorkbenchSnapGuides({ host, hostRef }) {
  const guides = useSyncExternalStore(host.subscribe, host.snapshot);
  const node = hostRef?.current;
  if (!node || !guides.length) return null;
  const viewport = node.getBoundingClientRect();
  const paths = guides.map(match => {
    const { rect, target, axis, kind } = match;
    const horizontal = axis === 'x';
    const offset = horizontal ? viewport.left : viewport.top;
    const acrossOffset = horizontal ? viewport.top : viewport.left;
    const low = horizontal ? 'top' : 'left', size = horizontal ? 'height' : 'width';
    const start = Math.max(0, Math.min(rect[low], target?.[low] ?? rect[low]) - acrossOffset - 8);
    const end = Math.min(horizontal ? viewport.height : viewport.width,
      Math.max(rect[low] + rect[size], target ? target[low] + target[size] : 0) - acrossOffset + 8);
    const value = match.value - offset;
    const line = (a, b, c, d) => horizontal ? `M${a},${b}L${c},${d}` : `M${b},${a}L${d},${c}`;
    let d = line(value, start, value, end);
    let label = kind === 'grid' ? 'Grid' : 'Edge';
    let labelX = horizontal ? value + 8 : end - 20, labelY = horizontal ? start + 12 : value - 8;
    if (kind === 'gap') {
      const other = match.targetEdge - offset;
      const across = (Math.max(rect[low], target[low]) + Math.min(rect[low] + rect[size], target[low] + target[size])) / 2 - acrossOffset;
      d += line(other, start, other, end) + line(other, across, value, across)
        + line(other, across - 4, other, across + 4) + line(value, across - 4, value, across + 4);
      label = match.gap === 0 ? 'Flush' : `${Math.round(match.gap * 10) / 10} px`;
      labelX = horizontal ? (other + value) / 2 : across + 8;
      labelY = horizontal ? across - 8 : (other + value) / 2;
    }
    const textWidth = label.length * 6 + 12;
    labelX = Math.max(textWidth / 2 + 4, Math.min(viewport.width - textWidth / 2 - 4, labelX));
    labelY = Math.max(16, Math.min(viewport.height - 16, labelY));
    return <g key={axis} data-snap-axis={axis} data-snap-kind={kind}>
      <path className="workbench-snap-guides__underlay" d={d} />
      <path d={d} />
      <rect x={labelX - textWidth / 2} y={labelY - 11} width={textWidth} height={16} />
      <text x={labelX} y={labelY}>{label}</text>
    </g>;
  });
  return createPortal(<svg className="workbench-snap-guides" aria-hidden="true" width={viewport.width} height={viewport.height}>{paths}</svg>, node);
}
