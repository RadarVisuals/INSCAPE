import { inferredCellGap, partitionInnerLines } from './receptionPartition.js';
import './receptionInnerLines.css';

// Both hosts supply their visible, projected cell rectangles. Lines carry no
// input or saved geometry, and never reveal hidden cells in public documents.
export default function ReceptionInnerLines({ frames, gap, appearance, bounds, style }) {
  if (!appearance) return null;
  const lines = partitionInnerLines(frames.map(r => ({ x: r.left, y: r.top, width: r.width, height: r.height })), gap ?? inferredCellGap(frames));
  return <svg className="reception-inner-lines" aria-hidden="true" focusable="false"
    viewBox={`${bounds.left} ${bounds.top} ${bounds.width} ${bounds.height}`} preserveAspectRatio="none" style={style}>
    <path fill="none" stroke={appearance.color} strokeWidth={appearance.width} strokeOpacity={appearance.opacity} strokeLinecap="butt"
      d={lines.map(line => line.axis === 'x' ? `M${line.position},${line.from}V${line.to}` : `M${line.from},${line.position}H${line.to}`).join(' ')} />
  </svg>;
}
