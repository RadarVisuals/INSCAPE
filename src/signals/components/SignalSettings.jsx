import { useSignalStore } from '../state/useSignalStore.js';

const OPTIONS = [
  ['notifications', 'Keeper notifications'], ['speech', 'Speech'], ['visualEffects', 'Visual signal effects'], ['audio', 'Audio notifications']
];
export default function SignalSettings() {
  const settings = useSignalStore((state) => state.settings); const updateSetting = useSignalStore((state) => state.updateSetting);
  return (
    <section className="signal-settings" aria-labelledby="signal-settings-title">
      <header><span>SYS.PREF</span><h2 id="signal-settings-title">Signals</h2></header>
      {OPTIONS.map(([key, label]) => (
        <label key={key}><span>{label}{key === 'audio' && <small> Default off</small>}</span>
          <input type="checkbox" checked={settings[key]} onChange={(event) => updateSetting(key, event.target.checked)} /></label>
      ))}
      {!settings.notifications && <p>History and refresh remain active.</p>}
    </section>
  );
}
