import { Check, X } from 'lucide-react';
import { useSignalStore } from '../../signals/state/useSignalStore.js';
import { SYSTEM_WORKFLOW_SURFACE_IDS } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import { OwnerSystemWorkflowSelectMenu } from './OwnerSystemWorkflowWorkspaceControls.jsx';
import { workbenchGridColorPreview } from './workbenchPreferences.js';

const SIGNAL_OPTIONS = [
  ['notifications', 'Activity notifications'], ['speech', 'Speech'],
  ['visualEffects', 'Visual signal effects'], ['audio', 'Audio notifications'],
];
const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
const themeOptions = SYSTEM_WORKFLOW_SURFACE_IDS.map((value) => ({ label: titleCase(value), value }));
const guideOptions = ['LINES', 'DOTS', 'NONE'].map((value) => ({ label: titleCase(value), value }));

function CheckControl({ checked, disabled = false, label, onChange }) {
  return <label className="system-workflow__check-control"><span>{label}</span>
    <input checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} type="checkbox" /><i aria-hidden="true">{checked && <Check size={12} />}</i></label>;
}

export default function OwnerSystemWorkflowSettings({ appearance, controller, menuSurface, onClose,
  onWorkbenchPreferencesChange, phase, workbenchPreferences }) {
  const signalSettings = useSignalStore((state) => state.settings);
  const signalProfile = useSignalStore((state) => state.profileAddress);
  const profile = controller.draft.profileAddress;
  const updateSignalSetting = useSignalStore((state) => state.updateSetting);
  const gap = workbenchPreferences.moduleGap;
  return <aside aria-hidden={phase === 'closing' || undefined} aria-label="Settings"
    className="system-workflow__settings system-workflow__motion-panel" inert={phase === 'closing' ? '' : undefined} role="dialog">
    <section className="system-workflow__settings-section"><header><strong>Activity</strong></header>
      <div>{SIGNAL_OPTIONS.map(([key, label]) => <CheckControl checked={signalProfile === profile && signalSettings[key]} disabled={signalProfile !== profile} key={key} label={label}
        onChange={(checked) => updateSignalSetting(key, checked, profile)} />)}</div>
    </section>
    <section className="system-workflow__settings-section system-workflow__settings-theme"><header><strong>Workbench</strong><span>Local to this device</span></header>
      <label><span>Background</span><OwnerSystemWorkflowSelectMenu label="Workbench background" menuSurface={menuSurface} onChange={(surfaceId) => onWorkbenchPreferencesChange({ surfaceId })} options={themeOptions} value={workbenchPreferences.surfaceId} /></label>
      <label><span>Grid display</span><OwnerSystemWorkflowSelectMenu label="Workbench grid display" menuSurface={menuSurface} onChange={(gridMode) => onWorkbenchPreferencesChange({ gridMode })} options={guideOptions} value={workbenchPreferences.gridMode} /></label>
      <label><span>Grid color</span><span className="system-workflow__settings-color"><input aria-label="Workbench grid color" onChange={(event) => onWorkbenchPreferencesChange({ gridColor: event.target.value })} type="color" value={workbenchPreferences.gridColor || workbenchGridColorPreview(workbenchPreferences.surfaceId)} /><button disabled={!workbenchPreferences.gridColor} onClick={() => onWorkbenchPreferencesChange({ gridColor: null })} type="button">Auto</button></span></label>
      <CheckControl checked={workbenchPreferences.shortcutSnap} label="Grid snapping"
        onChange={(shortcutSnap) => onWorkbenchPreferencesChange({ shortcutSnap })} />
      <CheckControl checked={workbenchPreferences.edgeSnap} label="Module edge snapping" onChange={edgeSnap => onWorkbenchPreferencesChange({ edgeSnap })} />
      <label><span>Space between modules (px)</span><input aria-label="Space between modules" aria-describedby="workbench-gap-description" type="number" min={0} max={128} value={gap} onChange={event => { const moduleGap = event.target.valueAsNumber; if (Number.isFinite(moduleGap) && moduleGap >= 0 && moduleGap <= 128) onWorkbenchPreferencesChange({ moduleGap }); }} /></label>
      <svg className="workbench-gap-preview" viewBox="0 0 320 64" role="img" aria-label={`${gap} pixel spacing between modules`}>
        <rect x={160 - gap / 2 - 64} y="5" width="64" height="30" />
        <rect x={160 + gap / 2} y="5" width="64" height="30" />
        <path d={`M${160 - gap / 2},40v8m0,-4h${gap}m0,-4v8`} />
        <text x="160" y="61">{gap === 0 ? 'Flush join' : `${gap} px`}</text>
      </svg>
      <p>Nearby module edges take priority over the grid. A zero gap joins modules flush.</p>
      <p id="workbench-gap-description">Guides show the active edge, grid line or spacing. Pull away to release a snap, or hold Alt to bypass snapping.</p>
    </section>
    <section className="system-workflow__settings-section system-workflow__settings-theme"><header><strong>Display Module</strong><span>Included when published</span></header>
      <label><span>Background</span><OwnerSystemWorkflowSelectMenu label="Display Module background" menuSurface={menuSurface} onChange={(surfaceId) => controller.setAppearance({ surfaceId })} options={themeOptions} value={appearance.surfaceId} /></label>
      <label><span>Grid display</span><OwnerSystemWorkflowSelectMenu label="Display Module grid display" menuSurface={menuSurface} onChange={(guideMode) => controller.setAppearance({ guideMode })} options={guideOptions} value={appearance.guideMode} /></label>
      <label><span>Snap grid</span><span><input aria-label="Snap grid" max="8" min="-8" onChange={(event) => controller.setAppearance({ guideSize: Number(event.target.value) })} type="range" value={appearance.guideSize} /><output>{appearance.guideSize > 0 ? '+' : ''}{appearance.guideSize} {appearance.guideSize < 0 ? 'Fine' : appearance.guideSize > 0 ? 'Coarse' : 'Base'}</output></span></label>
      <label><span>Grid color</span><input aria-label="Display Module grid color" onChange={(event) => controller.setAppearance({ guideColor: event.target.value })} type="color" value={appearance.guideColor} /></label>
    </section>
    <section className="system-workflow__settings-section system-workflow__settings-theme"><header><strong>Interface</strong></header>
      <label><span>Windows</span><OwnerSystemWorkflowSelectMenu label="Menu theme" menuSurface={menuSurface} onChange={(menuSurfaceId) => controller.setAppearance({ menuSurfaceId })} options={themeOptions} value={appearance.menuSurfaceId} /></label>
      <CheckControl checked={workbenchPreferences.chromeNoise} label="Chrome noise"
        onChange={(chromeNoise) => onWorkbenchPreferencesChange({ chromeNoise })} />
    </section>
    <button aria-label="Close Settings" className="system-workflow__settings-close" onClick={onClose} title="Close Settings" type="button"><X size={14} /></button>
  </aside>;
}
