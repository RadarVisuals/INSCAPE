import { createPortal } from 'react-dom';
import { useSignalStore } from '../../signals/state/useSignalStore.js';
import { LATTICE_PRODUCTION_SURFACE_IDS } from '../domain/latticeProductionDraft.js';
import './modul8rSettings.css';

export default function Modul8rSettingsSurface({ menuSurfaceId, onClose, onMenuSurfaceChange, onSurfaceChange, surfaceId }) {
  const settings = useSignalStore((state) => state.settings);
  const updateSetting = useSignalStore((state) => state.updateSetting);
  if (typeof document === 'undefined') return null;
  return createPortal(<section aria-labelledby="modul8r-settings-title" aria-modal="false" className="modul8r-settings"
    data-lattice-chrome data-lattice-menu-surface data-menu-surface={menuSurfaceId} role="dialog">
    <header><strong id="modul8r-settings-title">SETTINGS</strong><button aria-label="Close Modulator settings" onClick={onClose} type="button">×</button></header>
    <main>
      <header><strong>ACTIVITY</strong><span>KEEPER SIGNALS</span></header>
      <div className="modul8r-settings__options">
        {[['notifications', 'KEEPER NOTIFICATIONS'], ['speech', 'SPEECH'], ['visualEffects', 'VISUAL SIGNAL EFFECTS'], ['audio', 'AUDIO NOTIFICATIONS']].map(([key, label]) => <label key={key}>
          <span>{label}{key === 'audio' && <small>DEFAULT OFF</small>}</span>
          <input checked={settings[key]} onChange={(event) => updateSetting(key, event.target.checked)} type="checkbox" />
        </label>)}
      </div>
      {!settings.notifications && <p>HISTORY AND REFRESH REMAIN ACTIVE.</p>}
      <section className="modul8r-settings__theme"><strong>THEME</strong>
        <label><span>WORKSPACE / SURFACE</span><select value={surfaceId} onChange={(event) => onSurfaceChange(event.target.value)}>{LATTICE_PRODUCTION_SURFACE_IDS.map((id) => <option key={id} value={id}>{id.toUpperCase()}</option>)}</select></label>
        <label><span>MENU / INTERFACE</span><select value={menuSurfaceId} onChange={(event) => onMenuSurfaceChange(event.target.value)}>{LATTICE_PRODUCTION_SURFACE_IDS.map((id) => <option key={id} value={id}>{id.toUpperCase()}</option>)}</select></label>
        <p>SESSION ONLY / NOT PERSISTED</p>
      </section>
    </main>
  </section>, document.body);
}
