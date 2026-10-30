import CommittedColourControls from '../colour/CommittedColourControls.jsx';
import './receptionColour.css';

// Content only: the host owns window lifetime, target selection and saving.
export default function ReceptionColourPanel({ color, disabled, scopeKey, getVersion, onChange, onPreview, onReset, resetLabel = 'Use grid background' }) {
  return <div className="reception-colour-content">
    <CommittedColourControls color={color} disabled={disabled} scopeKey={scopeKey} getVersion={getVersion}
      onChange={onChange} onPreview={onPreview} eyedropper />
    {onReset && <button type="button" className="workflow-tactile-control" disabled={disabled} onClick={onReset}>{resetLabel}</button>}
  </div>;
}
