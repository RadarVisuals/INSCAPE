// Buttons for the responsive preview inside the shared Editor.
export function ReceptionButton({ icon: Icon, children, label, ...props }) {
  return <button type="button" className="workflow-tactile-control" data-icon-only={Boolean(Icon && !children) || undefined} aria-label={label} title={label} {...props}>
    {Icon && <Icon aria-hidden="true" size={16} />}{children && <span>{children}</span>}
  </button>;
}
