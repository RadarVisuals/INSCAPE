import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { EFFECTS, effectDefaults, hasActiveEffects } from './effectCatalog.js';
import './animationModule.css';

function Parameter({ label, value, min, max, step, onCommit, disabled }) {
  const [input, setInput] = useState(String(value));
  useEffect(() => setInput(String(value)), [value]);
  const valid = input.trim() !== '' && Number.isFinite(Number(input)) && Number(input) >= min && Number(input) <= max;
  const commit = () => { if (valid && Number(input) !== value) onCommit(Number(input)); };
  return <label className="animation-module__parameter"><span>{label}</span>
    <input aria-label={`${label} slider`} type="range" min={min} max={max} step={step} value={valid ? input : value} disabled={disabled}
      onChange={event => setInput(event.target.value)} onPointerUp={event => { if (Number(event.currentTarget.value) !== value) onCommit(Number(event.currentTarget.value)); }}
      onPointerCancel={() => setInput(String(value))} onKeyUp={event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) commit(); }} onBlur={commit} />
    <input aria-label={label} type="number" min={min} max={max} step={step} value={input} disabled={disabled} aria-invalid={!valid}
      onChange={event => setInput(event.target.value)} onBlur={commit} onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); commit(); }
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setInput(String(value)); }
      }} />
    {!valid && <span role="alert">Use a value from {min} to {max}.</span>}
  </label>;
}

export default function AnimationModule({ target, onChange, disabled, disabledReason, preview, onPreview, reducedMotion }) {
  const [expanded, setExpanded] = useState(null);
  const [adding, setAdding] = useState(false);
  const addButton = useRef(null);
  const effectButtons = useRef({});
  if (!target) return <p role="status">Select one artwork in a Display to animate it.</p>;
  const animation = target.animation || {};
  const applied = EFFECTS.filter(effect => animation[effect.id]);
  const available = EFFECTS.filter(effect => !animation[effect.id]);
  const change = next => onChange(Object.keys(next).length ? next : null);
  const remove = id => {
    const next = { ...animation }; delete next[id];
    if (change(next) !== false) { setExpanded(null); requestAnimationFrame(() => addButton.current?.focus()); }
  };
  const setEnabled = (id, enabled) => {
    const value = { ...animation[id] };
    if (enabled) delete value.enabled; else value.enabled = false;
    change({ ...animation, [id]: value });
  };
  return <div className="animation-module">
    <div className="animation-module__target">{target.src && <img src={target.src} alt="" />}<div><strong>{target.label}</strong><small>{target.scope}</small><small>Follows selection</small></div></div>
    {!applied.length && <p>No effects on this artwork.</p>}
    {applied.map(effect => <section key={effect.id}>
      <div className="animation-module__effect-row">
        <button ref={node => { effectButtons.current[effect.id] = node; }} type="button" aria-label={effect.label + ' settings'} aria-expanded={expanded === effect.id}
          onClick={() => setExpanded(expanded === effect.id ? null : effect.id)}><span>{effect.label}</span><ChevronDown size={12} aria-hidden="true" /></button>
        <label className="animation-module__toggle"><input type="checkbox" aria-label={effect.label}
          checked={animation[effect.id].enabled !== false} disabled={disabled}
          onChange={event => setEnabled(effect.id, event.target.checked)} />{animation[effect.id].enabled === false ? 'Off' : 'On'}</label>
        <button type="button" aria-label={'Remove ' + effect.label} disabled={disabled} onClick={() => remove(effect.id)}>Remove</button>
      </div>
      {expanded === effect.id && <div className="animation-module__settings">
        <p>{effect.description}</p>
        {effect.parameters.map(({ key, label, min, max, step, displayFactor = 1 }) => <Parameter key={key}
          label={label} value={animation[effect.id][key] * displayFactor} min={min * displayFactor} max={max * displayFactor} step={step * displayFactor} disabled={disabled}
          onCommit={value => change({ ...animation, [effect.id]: { ...animation[effect.id], [key]: value / displayFactor } })} />)}
      </div>}
    </section>)}
    <button ref={addButton} type="button" aria-expanded={adding} disabled={disabled || !available.length}
      onClick={() => setAdding(!adding)}>Add effect</button>
    {adding && available.length > 0 && <div className="animation-module__effect-picker" role="group" aria-label="Available effects">
      {available.map(effect => <button key={effect.id} type="button" disabled={disabled} aria-label={'Add ' + effect.label}
        onClick={() => {
          if (change({ ...animation, [effect.id]: effectDefaults(effect) }) !== false) {
            setAdding(false); setExpanded(effect.id);
            requestAnimationFrame(() => effectButtons.current[effect.id]?.focus());
          }
        }}>{effect.label}<small>{effect.description}</small></button>)}
    </div>}
    <button type="button" aria-pressed={preview} disabled={!preview && (disabled || reducedMotion || !hasActiveEffects(animation))}
      onClick={() => onPreview(!preview)}>{preview ? 'Stop preview' : 'Preview'}</button>
    {applied.length > 0 && <button type="button" disabled={disabled} onClick={() => {
      if (onChange(null) !== false) { setExpanded(null); setAdding(false); requestAnimationFrame(() => addButton.current?.focus()); }
    }}>Remove all effects</button>}
    <p>{reducedMotion ? 'Motion is off because reduced motion is enabled.' : disabled ? disabledReason : 'Preview runs in the Display. Stop it to position artwork.'}</p>
    <p>Off keeps your settings. Remove deletes the effect. Closing this module keeps all effects.</p>
  </div>;
}
