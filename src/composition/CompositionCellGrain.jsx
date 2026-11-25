import './compositionCellGrain.css';

// A cell overlay is independent of fill opacity and native content ordering.
// The noise asset already carries alpha; apply authored strength only once.
export default function CompositionCellGrain({ cell, grain = 0, scale = 1, radius = cell.radius || 0, style }) {
  if (cell.grainOverContent === false || !(grain > 0)) return null;
  return <span aria-hidden="true" data-cell-grain={cell.id} className="composition-cell-grain"
    style={{ ...style, opacity: grain, borderRadius: radius, backgroundSize: `${128 * scale}px` }} />;
}
