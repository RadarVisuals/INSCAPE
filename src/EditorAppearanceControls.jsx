import { interfaceTheme, useInterfaceTheme } from './interfaceTheme.js';

export default function EditorAppearanceControls() {
  const { mode, colors, colorError } = useInterfaceTheme();
  const defaults = getComputedStyle(document.documentElement);
  return <fieldset className="editor-appearance-controls">
    <legend>Editor colors</legend>
    <p>Personal to this device. Your published work keeps its own colors.</p>
    {[['panel', 'Panels & header'], ['workspace', 'Workspace'], ['accent', 'Accent']].map(([name, label]) => {
      const value = colors[mode][name] || defaults.getPropertyValue(`--editor-default-${name}`).trim();
      return <label key={name}><span>{label}</span><span className="editor-appearance-swatch">
        <input key={`${mode}:${value}`} type="text" className="editor-appearance-hex" aria-label={`Editor ${label.toLowerCase()} hex`}
          defaultValue={value.toUpperCase()} maxLength={7} spellCheck={false}
          onBlur={event => {
            const hex = event.currentTarget.value.trim();
            if (/^#[0-9a-f]{6}$/i.test(hex)) interfaceTheme.setColor(name, hex);
            else event.currentTarget.value = value.toUpperCase();
          }} onKeyDown={event => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') { event.stopPropagation(); event.currentTarget.value = value.toUpperCase(); event.currentTarget.blur(); }
          }} />
        <input type="color" aria-label={`Editor ${label.toLowerCase()} color`}
          value={value} onInput={event => interfaceTheme.setColor(name, event.currentTarget.value)} />
      </span></label>;
    })}
    <button type="button" className="editor-appearance-reset" onClick={() => interfaceTheme.resetColors()}>Reset editor colors</button>
    {colorError && <div role="alert"><p>{colorError}</p><button type="button" onClick={() => interfaceTheme.retryColors()}>Retry saving colors</button></div>}
  </fieldset>;
}
