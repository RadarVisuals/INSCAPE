export const keyClass = 'workflow-tactile-control';
export function IconKey({ label, icon: Icon, ...props }) {
  return (
    <button type="button" className={keyClass} aria-label={label} title={label} {...props}>
      <Icon aria-hidden="true" size={18} strokeWidth={1.6} />
    </button>
  );
}
export { default as NumberField } from '../src/colour/NumberField.jsx';
export function CheckField({ label, value, onChange }) {
  return (
    <label className="ds-studio-check">
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
