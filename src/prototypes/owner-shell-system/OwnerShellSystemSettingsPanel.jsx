import { OwnerShellSystemSelectMenu } from './OwnerShellSystemControls.jsx';

const surfaceOptions = (surfaceIds) => surfaceIds.map((id) => ({
  label: id.toUpperCase(),
  value: id,
}));

export default function OwnerShellSystemSettingsPanel({
  gridSurface,
  gridDisplay,
  gridDisplayOptions,
  gridDotSize,
  menuSurface,
  onGridDisplayChange,
  onGridDotSizeChange,
  onGridSurfaceChange,
  onMenuSurfaceChange,
  onSignalChange,
  onVisitorPresentationChange,
  phase,
  signalOptions,
  signalSettings,
  surfaceIds,
  visitorOptions,
  visitorPresentation,
}) {
  const themeOptions = surfaceOptions(surfaceIds);

  return <aside
    aria-hidden={phase === 'closing' || undefined}
    aria-label="Settings"
    className="owner-shell-system__settings owner-shell-system__motion-panel"
    data-panel-phase={phase}
    inert={phase === 'closing' ? '' : undefined}
  >
    <section className="owner-shell-system__settings-section">
      <header><strong>ACTIVITY</strong><span>KEEPER SIGNALS</span></header>
      <div className="owner-shell-system__settings-options">{signalOptions.map(([key, label]) => <label key={key}>
        <span>{label}{key === 'audio' && <small>DEFAULT OFF</small>}</span>
        <input checked={signalSettings[key]} onChange={(event) => onSignalChange(key, event.target.checked)} type="checkbox" />
      </label>)}</div>
      {!signalSettings.notifications && <p>HISTORY AND REFRESH REMAIN ACTIVE.</p>}
    </section>

    <section className="owner-shell-system__settings-section owner-shell-system__settings-theme">
      <header><strong>THEME</strong><span>SEPARATE SURFACES</span></header>
      <label><span>GRID DISPLAY</span><OwnerShellSystemSelectMenu
        label="GRID DISPLAY"
        menuSurface={menuSurface}
        onChange={onGridDisplayChange}
        options={gridDisplayOptions}
        value={gridDisplay}
      /></label>
      {gridDisplay === 'dots' && <label className="owner-shell-system__settings-dot-size">
        <span>DOT SIZE</span>
        <span><input aria-label="Dot size" max="4" min="1" onChange={(event) => onGridDotSizeChange(Number(event.target.value))}
          step="0.25" type="range" value={gridDotSize} /><output>{gridDotSize} PX</output></span>
      </label>}
      <label><span>WORKSPACE / GRID</span><OwnerShellSystemSelectMenu
        label={gridSurface.toUpperCase()}
        menuSurface={menuSurface}
        onChange={onGridSurfaceChange}
        options={themeOptions}
        value={gridSurface}
      /></label>
      <label><span>WINDOWS / INTERFACE</span><OwnerShellSystemSelectMenu
        label={menuSurface.toUpperCase()}
        menuSurface={menuSurface}
        onChange={onMenuSurfaceChange}
        options={themeOptions}
        value={menuSurface}
      /></label>
      <p>{gridDisplay === 'dots' ? 'DOT COLOR / MATCHES GRID LINES' : 'SESSION ONLY / NOT PERSISTED'}</p>
    </section>

    <section className="owner-shell-system__settings-section">
      <header><strong>VISITOR PRESENTATION</strong><span>NEXT PUBLICATION</span></header>
      <div className="owner-shell-system__settings-options">{visitorOptions.map(([key, label]) => <label key={key}>
        <span>{label}</span>
        <input checked={visitorPresentation[key]} onChange={(event) => onVisitorPresentationChange(key, event.target.checked)} type="checkbox" />
      </label>)}</div>
      <p>THEME EXISTS HERE ONCE. NO DUPLICATE GLOBAL CONTROL.</p>
    </section>
  </aside>;
}
