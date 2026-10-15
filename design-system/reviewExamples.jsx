import React from 'react';
export { PropertiesPreview } from './propertiesSamples.jsx';

const states = [
  ['Normal', 'normal'],
  ['Hover', 'hover'],
  ['Pressed', 'pressed'],
  ['Selected', 'selected'],
  ['Keyboard focus', 'focus'],
  ['Unavailable', 'disabled'],
];

export function ControlStatesSheet({ onAction, status }) {
  return (
    <section className="ds-state-sheet" aria-labelledby="state-sheet-title">
      <div className="ds-example-heading">
        <h2 id="state-sheet-title">Button states</h2>
        {status}
      </div>
      <p className="ds-caption">
        The same button in each state, shown in both themes. These samples hold their pictured
        state; the controls above are interactive.
      </p>
      <div className="ds-state-themes">
        {['carbon', 'mist'].map((theme) => (
          <section
            className="ds-flat-preview"
            data-menu-surface={theme}
            key={theme}
            aria-label={`${theme} button states`}
          >
            <div className="ds-control-examples ds-state-material" data-workflow-material="tactile">
              <h3>{theme === 'carbon' ? 'Carbon' : 'Mist'}</h3>
              <div className="ds-state-grid">
                {states.map(([label, state]) => (
                  <figure key={state}>
                    <figcaption>{label}</figcaption>
                    <button
                      type="button"
                      className={`workflow-tactile-control${state === 'selected' ? ' ds-primary-selection' : ''}`}
                      data-example-state={state}
                      aria-pressed={state === 'selected' ? true : undefined}
                      disabled={state === 'disabled'}
                      aria-label={`${label} button example, ${theme}`}
                      onClick={() => onAction(`${label} button example`)}
                    >
                      Select
                    </button>
                  </figure>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
