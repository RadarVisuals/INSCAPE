import EditorToolbarPopover from '../public/ownerSystemWorkflow/EditorToolbarPopover.jsx';
import CommittedColourControls from '../colour/CommittedColourControls.jsx';

export default function ShapeFillButton({ fill, opacity, title = 'Fill', children, error }) {
  return <EditorToolbarPopover label={`${title} color and opacity`} className="shape-fill-button" disabled={fill.disabled}
    trigger={<><span style={{ backgroundColor: fill.color }} aria-hidden="true" />{Math.round(opacity * 100)}%</>}>
    <strong>{title}</strong><CommittedColourControls {...fill} variant="inspector" />
    {children}{error && <p role="alert">{error}</p>}
  </EditorToolbarPopover>;
}
