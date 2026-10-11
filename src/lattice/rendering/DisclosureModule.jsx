import './disclosureModule.css';

export default function DisclosureModule({ active, children, className, contentClassName, headerAction = null, id, label, onToggle, style }) {
  const panelId = `${id}-panel`;
  return <section className={`lattice-disclosure-module ${className}`} data-active={active || undefined}
    data-header-action={headerAction ? true : undefined} style={style}>
    <button aria-controls={panelId} aria-expanded={active} onClick={onToggle}>
      <i /><strong>{label}</strong>
    </button>
    {headerAction && <span className="lattice-disclosure-module__header-action">{headerAction}</span>}
    <div aria-hidden={!active} className={`lattice-disclosure-module__panel ${contentClassName}`} data-active={active || undefined}
      data-lattice-viewer-scroll inert={!active ? '' : undefined} id={panelId}>{children}</div>
  </section>;
}
