import './iconSwitch.css';

export default function IconSwitch({ label, disabled, checked, onChange, title, offIcon: OffIcon, onIcon: OnIcon, className }) {
  const Icon = checked ? OnIcon : OffIcon;
  return <button type="button" className={className ? `icon-switch ${className}` : 'icon-switch'} role="switch" disabled={disabled} aria-label={label}
    aria-checked={checked} title={title} onClick={() => onChange(!checked)}>
    <span className="icon-switch-track" aria-hidden="true"><span className="icon-switch-thumb"><Icon size={15} /></span></span>
  </button>;
}
