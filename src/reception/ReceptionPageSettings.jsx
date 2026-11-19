import { useInterfaceTheme } from '../interfaceTheme.js';
import CommittedColourControls, { CommittedOpacityControl } from '../colour/CommittedColourControls.jsx';
import EditorToolbarPopover from '../public/ownerSystemWorkflow/EditorToolbarPopover.jsx';
import ReceptionAtmosphere from './ReceptionAtmosphere.jsx';
import { receptionLight } from './receptionAtmosphere.js';
import '../public/ownerSystemWorkflow/workbenchWindowChrome.css';

export default function ReceptionPageSettings({ reception, disabled, getVersion, onChange, onPreview, preview }) {
  const { mode } = useInterfaceTheme(), light = receptionLight(reception);
  const shown = { ...reception, ...preview };
  const patchLight = patch => ({ lighting: { ...light, ...patch } });
  return <fieldset className="reception-light-settings" disabled={disabled} aria-label="Page appearance">
    <legend>Page atmosphere</legend>
    <div className="reception-atmosphere-sample" style={{ '--reception-page-background': shown.backgroundColor || undefined }}>
      <div className="reception-atmosphere-sample-header"><ReceptionAtmosphere reception={shown} /></div>
    </div>
    <p>Light from the header divider. These settings save to your Reception and appear in Preview.</p>
    <label className="workbench-inspector-check"><input type="checkbox" checked={light.enabled}
      onChange={event => onChange(patchLight({ enabled: event.target.checked }))} />Light</label>
    <div className="reception-light-direction" role="group" aria-label="Light direction">
      {['down', 'up', 'both'].map(direction => <button key={direction} type="button" className="workflow-tactile-control"
        disabled={!light.enabled} aria-pressed={light.direction === direction} onClick={() => onChange(patchLight({ direction }))}>
        {direction === 'down' ? 'Down' : direction === 'up' ? 'Up' : 'Both'}
      </button>)}
    </div>
    {[
      ['Page background', reception.backgroundColor || (mode === 'light' ? '#dedbd3' : '#171717'), patch => ({ backgroundColor: patch.color })],
      ['Light color', light.color, patch => patchLight({ color: patch.color })],
    ].map(([label, color, patch]) => <div className="reception-light-color" key={label}><span>{label}</span>
      <EditorToolbarPopover label={label === 'Light color' ? label : `${label} color`} className="reception-bento-color" disabled={disabled || label === 'Light color' && !light.enabled}
        trigger={<><span className="reception-light-swatch" style={{ backgroundColor: color }} aria-hidden="true" />{color.slice(1).toUpperCase()}</>}>
        <strong>{label}</strong><CommittedColourControls color={color} disabled={disabled || label === 'Light color' && !light.enabled} variant="inspector"
          scopeKey={`reception:page:${label}`} getVersion={getVersion} onChange={value => onChange(patch(value))}
          onPreview={value => onPreview(value ? patch(value) : null)} />
        {label === 'Page background' && reception.backgroundColor && <button type="button" className="workflow-tactile-control"
          onClick={() => onChange({ backgroundColor: null })}>Use theme color</button>}
      </EditorToolbarPopover>
    </div>)}
    {[['strength', 'Light strength'], ['spread', 'Light spread'], ['position', 'Light position']].map(([key, label]) =>
      <CommittedOpacityControl key={key} caption={label.replace('Light ', '')} label={label} color={light.color} opacity={light[key]}
        disabled={disabled || !light.enabled} getVersion={getVersion} scopeKey={`reception:lighting:${key}`}
        onChange={patch => onChange(patchLight({ [key]: patch.opacity }))}
        onPreview={patch => onPreview(patch ? patchLight({ [key]: patch.opacity }) : null)} />)}
    <p>Position: left → right.</p>
  </fieldset>;
}
