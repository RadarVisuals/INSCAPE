import { ChevronRight, Pin } from 'lucide-react';
import { useState } from 'react';
import CommittedColourControls from './CommittedColourControls.jsx';
import { useInspectorColourPreference } from './InspectorColourPreferences.jsx';

// The compact inspector exposes the same colour editor and gesture owner.
// Disclosure state is UI only; closing/unmounting cancels an unfinished gesture.
export default function InspectorColourControls({ label = 'Fill', ...props }) {
  const preference = useInspectorColourPreference(), pinned = preference?.pinned.includes(label);
  const [expanded, setExpanded] = useState(false), open = pinned || expanded;
  return <details className="workbench-inspector-colour" open={open} onToggle={event => {
    setExpanded(event.currentTarget.open);
    if (!event.currentTarget.open && pinned) preference.update(current => (current || []).filter(item => item !== label));
  }}>
    <summary><span>{label}</span><span className="workbench-inspector-colour-value"><span className="workbench-inspector-swatch" style={{ backgroundColor: props.color }} />
      <span>{props.color?.slice(1).toUpperCase()}</span>{props.opacity !== undefined && <span>{Math.round(props.opacity * 100)}%</span>}<ChevronRight /></span></summary>
    {open && <><CommittedColourControls {...props} variant="inspector" />
      {preference && <button type="button" className="workbench-inspector-pin" aria-label={`Keep ${label.toLowerCase()} picker open`}
      title="Keep picker open when changing selection" aria-pressed={Boolean(pinned)} onClick={() => preference.update(current => pinned ? current.filter(item => item !== label) : [...(current || []), label])}><Pin /><span>Keep picker open</span></button>}
    </>}
  </details>;
}
