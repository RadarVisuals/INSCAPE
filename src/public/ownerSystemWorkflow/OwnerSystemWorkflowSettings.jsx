import { Check, X } from 'lucide-react';
import { useSignalStore } from '../../signals/state/useSignalStore.js';
import { SYSTEM_WORKFLOW_SURFACE_IDS } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { OwnerSystemWorkflowSelectMenu } from './OwnerSystemWorkflowWorkspaceControls.jsx';

const SIGNAL_OPTIONS = [
  ['notifications', 'Activity notifications'], ['speech', 'Speech'],
  ['visualEffects', 'Visual signal effects'], ['audio', 'Audio notifications'],
];
const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
const themeOptions = SYSTEM_WORKFLOW_SURFACE_IDS.map((value) => ({ label: titleCase(value), value }));
const guideOptions = ['LINES', 'DOTS', 'NONE'].map((value) => ({ label: titleCase(value), value }));

function CheckControl({ checked, label, onChange }) {
  return <label className="system-workflow__check-control"><span>{label}</span>
    <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" /><i aria-hidden="true">{checked && <Check size={12} />}</i></label>;
}

export default function OwnerSystemWorkflowSettings({ appearance, controller, menuSurface, onClose, phase }) {
  const signalSettings = useSignalStore((state) => state.settings);
  const updateSignalSetting = useSignalStore((state) => state.updateSetting);
  return <aside aria-hidden={phase === 'closing' || undefined} aria-label="Settings"
    className="system-workflow__settings system-workflow__motion-panel" inert={phase === 'closing' ? '' : undefined} role="dialog">
    <section className="system-workflow__settings-section"><header><strong>Activity</strong></header>
      <div>{SIGNAL_OPTIONS.map(([key, label]) => <CheckControl checked={signalSettings[key]} key={key} label={label}
        onChange={(checked) => updateSignalSetting(key, checked)} />)}</div>
    </section>
    <section className="system-workflow__settings-section system-workflow__settings-theme"><header><strong>Theme</strong></header>
      <label><span>Grid display</span><OwnerSystemWorkflowSelectMenu label="Grid display" menuSurface={menuSurface} onChange={(guideMode) => controller.setAppearance({ guideMode })} options={guideOptions} value={appearance.guideMode} /></label>
      <label><span>Snap grid</span><span><input aria-label="Snap grid" max="8" min="-8" onChange={(event) => controller.setAppearance({ guideSize: Number(event.target.value) })} type="range" value={appearance.guideSize} /><output>{appearance.guideSize > 0 ? '+' : ''}{appearance.guideSize} {appearance.guideSize < 0 ? 'Fine' : appearance.guideSize > 0 ? 'Coarse' : 'Base'}</output></span></label>
      <label><span>Guide color</span><input aria-label="Guide color" onChange={(event) => controller.setAppearance({ guideColor: event.target.value })} type="color" value={appearance.guideColor} /></label>
      <label><span>Workspace / Grid</span><OwnerSystemWorkflowSelectMenu label="Canvas theme" menuSurface={menuSurface} onChange={(surfaceId) => controller.setAppearance({ surfaceId })} options={themeOptions} value={appearance.surfaceId} /></label>
      <label><span>Windows / Interface</span><OwnerSystemWorkflowSelectMenu label="Menu theme" menuSurface={menuSurface} onChange={(menuSurfaceId) => controller.setAppearance({ menuSurfaceId })} options={themeOptions} value={appearance.menuSurfaceId} /></label>
    </section>
    <button aria-label="Close Settings" className="system-workflow__settings-close" onClick={onClose} title="Close Settings" type="button"><X size={14} /></button>
  </aside>;
}
