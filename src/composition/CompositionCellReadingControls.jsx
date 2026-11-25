export default function CompositionCellReadingControls({ cell, disabled, onChange }) {
  if (!cell.members.some(id => id.startsWith('text:'))) return null;
  return <label className="workbench-inspector-check"><input type="checkbox" checked={Boolean(cell.singleLine)} disabled={disabled}
    onChange={event => onChange(event.target.checked)} />Single-line text</label>;
}
