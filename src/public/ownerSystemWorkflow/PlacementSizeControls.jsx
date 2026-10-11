import { useState } from 'react';
import { quantizeSystemWorkflowGridCoordinate } from '../../systemWorkflow/domain/systemWorkflowDraft.js';

function SizeField({ axis, label, placement, controller, disabled }) {
  const [value, setValue] = useState(String(Number(placement[axis].toFixed(3))));
  const [error, setError] = useState('');
  const commit = () => {
    if (disabled) return;
    const number = Number(value);
    if (!value.trim() || !Number.isFinite(number) || number < 1 || number > 512) {
      setError('Use a size from 1 to 512 canvas units.'); return;
    }
    const size = quantizeSystemWorkflowGridCoordinate(number);
    setError(''); setValue(String(Number(size.toFixed(3))));
    if (size === placement[axis]) return;
    controller.run(session => session.resizePlacement({ gridId: controller.selectedGridId,
      placementId: placement.id, expectedPlacement: placement, corner: 'se', freeScale: true,
      destination: { column: placement.column, row: placement.row,
        columnSpan: placement.columnSpan, rowSpan: placement.rowSpan, [axis]: size } }));
  };
  return <label>{label}<input aria-label={label} aria-invalid={Boolean(error)} type="number"
    min="1" max="512" step="any" value={value} disabled={disabled}
    onChange={event => setValue(event.target.value)} onBlur={commit}
    onKeyDown={event => {
      if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); commit(); }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setValue(String(Number(placement[axis].toFixed(3)))); setError(''); }
    }} />{error && <span role="alert">{error}</span>}</label>;
}

export default function PlacementSizeControls({ placement, controller, disabled }) {
  return <fieldset className="system-workflow__placement-size"><legend>Size · canvas units</legend>
    {[['columnSpan', 'Width'], ['rowSpan', 'Height']].map(([axis, label]) => <SizeField
      key={`${placement.id}:${placement.column}:${placement.row}:${placement.columnSpan}:${placement.rowSpan}:${axis}`}
      axis={axis} label={label} placement={placement} controller={controller} disabled={disabled} />)}
  </fieldset>;
}
