export default function ReceptionHeader({ navigation, children, className = '' }) {
  return <header className={`reception-window-header ${className}`}>
    {navigation}
    <div className="reception-window-actions workbench-tool-controls" data-window-chrome="flat">{children}</div>
  </header>;
}
