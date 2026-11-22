import { X } from 'lucide-react';
import { useSignalStore } from '../../signals/state/useSignalStore.js';
import InterfaceThemeToggle from '../../InterfaceThemeToggle.jsx';
import InterfacePaletteSelect from '../../InterfacePaletteSelect.jsx';
import { useInterfaceTheme } from '../../interfaceTheme.js';
import { OwnerSystemWorkflowSelectMenu } from './OwnerSystemWorkflowWorkspaceControls.jsx';
import { workbenchGridColorPreview } from './workbenchPreferences.js';
import './workbenchToolPanel.css';
import './settings.css';

const SIGNAL_OPTIONS = [
  ['notifications', 'Activity notifications'], ['speech', 'Speech'],
  ['visualEffects', 'Visual signal effects'], ['audio', 'Audio notifications'],
];
const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
const guideOptions = ['LINES', 'DOTS', 'NONE'].map((value) => ({ label: titleCase(value), value }));

function CheckControl({ checked, disabled = false, label, onChange }) {
  return <label className="system-workflow__check-control"><span>{label}</span>
    <input checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} type="checkbox" /></label>;
}

export default function OwnerSystemWorkflowSettings({ profileAddress: profile, onClose,
  onWorkbenchPreferencesChange, phase, workbenchPreferences, canvasPreferences = workbenchPreferences, onCanvasColorChange = canvasColor => onWorkbenchPreferencesChange({ canvasColor }), canvasGuides = true }) {
  const signalSettings = useSignalStore((state) => state.settings);
  const signalProfile = useSignalStore((state) => state.profileAddress);
  const signalPersistenceError = useSignalStore((state) => state.persistenceError);
  const updateSignalSetting = useSignalStore((state) => state.updateSetting);
  const { mode } = useInterfaceTheme();
  const gap = workbenchPreferences?.moduleGap;
  return <aside aria-hidden={phase === 'closing' || undefined} aria-label="Settings"
    data-workflow-material="tactile" data-workflow-finish="flat" data-workflow-palette="editor"
    className="workbench-tool-panel system-workflow__settings system-workflow__motion-panel" inert={phase === 'closing' ? '' : undefined} role="dialog">
    <header className="workbench-tool-panel-header"><h2>Settings</h2>
      <button aria-label="Close Settings" className="workbench-tool-panel-close" onClick={onClose} title="Close Settings" type="button"><X /></button>
    </header>
    <div className="system-workflow__settings-body">
    {canvasPreferences && <section className="system-workflow__settings-section system-workflow__settings-theme"><header><strong>Studio</strong></header>
      <div className="studio-canvas-color"><label htmlFor="studio-canvas-color">Canvas color</label>
        <span className="system-workflow__settings-color">
          <input id="studio-canvas-color" type="color" ref={input => {
            if (input && !canvasPreferences.canvasColor) input.value = getComputedStyle(input).getPropertyValue('--editor-surround').trim();
          }} value={canvasPreferences.canvasColor || '#000000'} onChange={event => onCanvasColorChange(event.target.value)} />
          <button type="button" aria-label="Reset canvas color" disabled={!canvasPreferences.canvasColor} onClick={() => onCanvasColorChange(null)}>Auto</button>
        </span>
      </div>
    </section>}
    {profile && <section className="system-workflow__settings-section"><header><strong>Activity</strong></header>
      <div>{SIGNAL_OPTIONS.map(([key, label]) => <CheckControl checked={signalProfile === profile && signalSettings[key]} disabled={signalProfile !== profile} key={key} label={label}
        onChange={(checked) => updateSignalSetting(key, checked, profile)} />)}</div>
      {signalProfile === profile && signalPersistenceError && <p role="alert">{signalPersistenceError}</p>}
    </section>}
    {workbenchPreferences && <section className="system-workflow__settings-section system-workflow__settings-theme"><header><strong>Workbench</strong><span>Local to this device</span></header>
      <CheckControl checked={workbenchPreferences.shortcutSnap} label="Grid snapping"
        onChange={(shortcutSnap) => onWorkbenchPreferencesChange({ shortcutSnap })} />
      <p>Hold Alt while dragging to temporarily switch grid snapping on or off.</p>
      {canvasGuides && <>
      <label><span>Grid display</span><OwnerSystemWorkflowSelectMenu flat label="Workbench grid display"  onChange={(gridMode) => onWorkbenchPreferencesChange({ gridMode })} options={guideOptions} value={workbenchPreferences.gridMode} /></label>
      <label><span>Grid color</span><span className="system-workflow__settings-color"><input aria-label="Workbench grid color" onChange={(event) => onWorkbenchPreferencesChange({ gridColor: event.target.value })} type="color" value={workbenchPreferences.gridColor || workbenchGridColorPreview(mode)} /><button disabled={!workbenchPreferences.gridColor} onClick={() => onWorkbenchPreferencesChange({ gridColor: null })} type="button">Auto</button></span></label>
      <label><span>Grid cell size</span><input key={workbenchPreferences.gridSpacing} aria-label="Workbench grid cell size" type="number" min="8" max="512" step="any" defaultValue={workbenchPreferences.gridSpacing}
        onBlur={event => { const gridSpacing = event.target.valueAsNumber; if (Number.isFinite(gridSpacing) && gridSpacing >= 8 && gridSpacing <= 512) onWorkbenchPreferencesChange({ gridSpacing }); else event.target.value = workbenchPreferences.gridSpacing; }}
        onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>
      <CheckControl checked={workbenchPreferences.edgeSnap} label="Module edge snapping" onChange={edgeSnap => onWorkbenchPreferencesChange({ edgeSnap })} />
      <label><span>Space between modules (px)</span><input aria-label="Space between modules" aria-describedby="workbench-gap-description" type="number" min={0} max={128} value={gap} onChange={event => { const moduleGap = event.target.valueAsNumber; if (Number.isFinite(moduleGap) && moduleGap >= 0 && moduleGap <= 128) onWorkbenchPreferencesChange({ moduleGap }); }} /></label>
      <svg className="workbench-gap-preview" viewBox="0 0 320 64" role="img" aria-label={`${gap} pixel spacing between modules`}>
        <rect x={160 - gap / 2 - 64} y="5" width="64" height="30" />
        <rect x={160 + gap / 2} y="5" width="64" height="30" />
        <path d={`M${160 - gap / 2},40v8m0,-4h${gap}m0,-4v8`} />
        <text x="160" y="61">{gap === 0 ? 'Flush join' : `${gap} px`}</text>
      </svg>
      <p>Local grid patches take priority. Outside patches, nearby module edges can align; a zero gap joins them flush.</p>
      <p id="workbench-gap-description">Guides show the active edge, grid line or spacing. Pull away to release a snap.</p>
      </>}
    </section>}
    <section className="system-workflow__settings-section system-workflow__settings-theme"><header><strong>Interface</strong><span>Everywhere on this device</span></header>
      <InterfaceThemeToggle />
      <InterfacePaletteSelect />
      {onWorkbenchPreferencesChange && <CheckControl checked={workbenchPreferences.chromeNoise} label="Chrome noise"
        onChange={(chromeNoise) => onWorkbenchPreferencesChange({ chromeNoise })} />}
    </section>
    </div>
  </aside>;
}
