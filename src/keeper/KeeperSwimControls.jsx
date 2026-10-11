import { KEEPER_SWIM_FIELDS, KEEPER_SWIM_DEFAULTS } from './keeperSwim.js';

export function KeeperSwimControls({ value, onChange, snake = false }) {
  const fields = Object.entries(KEEPER_SWIM_FIELDS).filter(([key]) => !snake || key !== 'staggerSeconds');
  return <fieldset className="keeper-swim-controls">
    <legend>Swim tuning</legend>
    {fields.map(([key, field]) => <label key={key}>
      {field.label} ({field.unit})
      <input aria-label={`Keeper ${field.label.toLowerCase()}`} type="number" key={value[key]}
        min={field.min} max={field.max} step={field.step} defaultValue={value[key]}
        onBlur={event => {
          const input = event.currentTarget, next = Number(input.value);
          if (!input.value || !input.validity.valid || next === value[key] || !onChange({ ...value, [key]: next }))
            input.value = String(value[key]);
        }} onKeyDown={event => {
          if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); event.currentTarget.blur(); }
          if (event.key === 'Escape') {
            event.preventDefault(); event.stopPropagation(); event.currentTarget.value = String(value[key]); event.currentTarget.blur();
          }
        }} />
    </label>)}
    <p>Lower times respond faster. {snake ? 'Spread opens body spacing with speed; gather closes it on stopping.' : 'Stagger delays each tentacle after the head.'} Press Enter or leave a field to apply while swimming.</p>
    <button type="button" disabled={fields.every(([key]) => value[key] === KEEPER_SWIM_DEFAULTS[key])}
      onClick={() => onChange({ ...value, ...Object.fromEntries(fields.map(([key]) => [key, KEEPER_SWIM_DEFAULTS[key]])) })}>Reset swim tuning</button>
  </fieldset>;
}
