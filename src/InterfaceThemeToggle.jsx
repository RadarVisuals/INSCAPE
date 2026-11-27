import { interfaceTheme, useInterfaceTheme } from './interfaceTheme.js';

export default function InterfaceThemeToggle() {
  const { mode, error } = useInterfaceTheme();
  return <div className="interface-theme-control">
    <div className="interface-theme-toggle" role="group" aria-label="Interface appearance">
      {['dark', 'light'].map(value => <button key={value} type="button" aria-pressed={mode === value}
        onClick={() => interfaceTheme.setMode(value)}>{value.toUpperCase()}</button>)}
    </div>
    {error && <p role="alert">{error}</p>}
  </div>;
}
