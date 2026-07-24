import { createPortal } from 'react-dom';
import { useSignalStore } from '../signals/state/useSignalStore.js';
import './settingsBrowser.css';

const OPTIONS = Object.freeze([
  ['notifications', 'KEEPER NOTIFICATIONS'],
  ['speech', 'SPEECH'],
  ['visualEffects', 'VISUAL SIGNAL EFFECTS'],
  ['audio', 'AUDIO NOTIFICATIONS']
]);

export default function SettingsBrowser({ visible = false, open = false, onOpenChange, actions = null }) {
  const settings = useSignalStore((state) => state.settings);
  const updateSetting = useSignalStore((state) => state.updateSetting);

  const workspace = open && typeof document !== 'undefined' ? createPortal(
    <section className="settings-browser" role="dialog" aria-modal="false" aria-labelledby="settings-browser-title"
      onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
      <header>
        <strong id="settings-browser-title">SETTINGS</strong>
      </header>
      <main>
        <header><strong>ACTIVITY</strong><span>KEEPER SIGNALS</span></header>
        <div className="settings-browser__options">
          {OPTIONS.map(([key, label]) => <label key={key}>
            <span>{label}{key === 'audio' && <small>DEFAULT OFF</small>}</span>
            <input type="checkbox" checked={settings[key]} onChange={(event) => updateSetting(key, event.target.checked)} />
            <i aria-hidden="true" />
          </label>)}
        </div>
        {!settings.notifications && <p>HISTORY AND REFRESH REMAIN ACTIVE.</p>}
        {actions && <section className="settings-browser__workspace" aria-label="Workspace actions">
          <strong>WORKSPACE</strong>
          <div>
            {actions.onPublish && <button type="button" onClick={() => { onOpenChange?.(false); actions.onPublish(); }}>PUBLISH PROFILE</button>}
            {actions.onAtelier && <button type="button" onClick={() => { onOpenChange?.(false); actions.onAtelier(); }}>OPEN ATELIER</button>}
          </div>
        </section>}
      </main>
    </section>,
    document.body
  ) : null;

  return <>
    <section className="settings-navigation-card" aria-hidden={!visible} data-visible={visible || undefined} data-expanded={open || undefined}>
      <button type="button" tabIndex={visible ? 0 : -1} aria-expanded={open} onClick={() => onOpenChange?.(!open)}>
        <strong>SETTINGS</strong><i aria-hidden="true">›</i>
      </button>
    </section>
    {workspace}
  </>;
}
