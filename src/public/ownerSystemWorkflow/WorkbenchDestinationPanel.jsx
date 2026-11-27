import { X } from 'lucide-react';
import './workflowTactile.css';
import './workflowFlat.css';
import './workbenchToolPanel.css';
import './workbenchDestinationPanel.css';

// Sidebar destinations share chrome; their callers retain actions and state.
export default function WorkbenchDestinationPanel({ title, onClose, closeLabel = `Close ${title}`, closeDisabled,
  className = '', children, ...props }) {
  return <aside aria-label={title} {...props}
    className={`workbench-tool-panel workbench-destination-panel system-workflow__token-scope system-workflow__motion-panel ${className}`}
    data-workflow-material="tactile" data-workflow-finish="flat">
    <header className="workbench-tool-panel-header"><h2>{title}</h2>
      <button type="button" className="workbench-tool-panel-close" aria-label={closeLabel} title={closeLabel}
        disabled={closeDisabled} onClick={onClose}><X aria-hidden="true" /></button>
    </header>
    {children}
  </aside>;
}
