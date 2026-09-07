import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { IDENTITY_CARD_LIMITS as limits, isValidIdentityCard, projectIdentityCard } from '../../profileIdentity/domain/identityCard.js';

export default function IdentityCardSettings({ card, configured = false, onSave, onPreview }) {
  const [editor, setEditor] = useState(null);
  const [error, setError] = useState(null);
  const save = useRef(null);
  useEffect(() => () => onPreview(null), [onPreview]);
  const start = scope => {
    save.current = onSave;
    setError(null); setEditor({ scope, card: structuredClone(card) });
  };
  const cancel = () => { setEditor(null); setError(null); onPreview(null); };
  const submit = event => {
    event.preventDefault();
    if (!isValidIdentityCard(editor.card)) {
      setError('Use up to 16 fields: 60 characters per label, 2,000 per text, or 16 list entries of 160 characters.'); return;
    }
    if (configured && JSON.stringify(editor.card) === JSON.stringify(card)) { cancel(); return; }
    if (save.current(editor.card)) cancel();
    else setError('Could not save. Your changes are still here. If the card changed elsewhere, cancel and reopen Edit.');
  };
  const background = update => {
    const next = { ...editor.card.background, ...update };
    setEditor({ ...editor, card: { ...editor.card, background: next } }); onPreview(next);
  };
  const fields = next => setEditor({ ...editor, card: { ...editor.card, fields: next } });
  const updateField = (id, update) => fields(editor.card.fields.map(field => field.id === id ? { ...field, ...update } : field));
  const moveField = (index, offset) => {
    const next = [...editor.card.fields];
    [next[index], next[index + offset]] = [next[index + offset], next[index]]; fields(next);
  };
  const addField = () => fields([...editor.card.fields, { id: `field:${crypto.randomUUID()}`, label: '', type: 'text', value: '' }]);
  const actions = <><div className="identity-module__form-actions"><button type="submit">Save card</button>
    <button type="button" onClick={cancel}>Cancel</button></div>{error && <p role="alert">{error}</p>}</>;
  const visibleFields = projectIdentityCard(card).fields;
  return <>
    {onSave && <section aria-label="Identity background">
      <div className="identity-module__details-heading"><h3>Background</h3>
        {!editor && <button type="button" onClick={() => start('background')}>Edit background</button>}</div>
      {editor?.scope === 'background' ? <form className="identity-module__details-form" onSubmit={submit} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); }
      }}>
        <label>Background style<select autoFocus value={editor.card.background.type} onChange={event => background({ type: event.target.value })}>
          <option value="plain">Plain</option><option value="clouds">Clouds</option></select></label>
        {editor.card.background.type === 'clouds' && <>
          <label className="identity-module__checkbox"><input type="checkbox" checked={editor.card.background.color === null}
            onChange={event => background({ color: event.target.checked ? null : '#b6b6b6' })} />Use theme cloud color</label>
          {editor.card.background.color !== null && <label>Cloud color<input type="color" value={editor.card.background.color} onChange={event => background({ color: event.target.value })} /></label>}
          <label>Movement speed · {editor.card.background.speed.toFixed(1)}×<input type="range" min="0" max="2" step="0.1"
            aria-label="Cloud movement speed" value={editor.card.background.speed} onChange={event => background({ speed: Number(event.target.value) })} /></label>
        </>}
        {actions}
      </form> : <p>{card.background.type === 'clouds' ? 'Clouds' : 'Plain'}</p>}
    </section>}
    {(onSave || visibleFields.length > 0) && <section aria-label="Identity fields">
      <div className="identity-module__details-heading"><h3>Fields</h3>
        {onSave && !editor && <button type="button" onClick={() => start('fields')}>Edit fields</button>}</div>
      {editor?.scope === 'fields' ? <form className="identity-module__details-form" onSubmit={submit} onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); }
      }}>
        {editor.card.fields.map((field, index) => <fieldset className="identity-module__field-editor" key={field.id}>
          <legend>Field {index + 1}</legend>
          <label>Field name<input maxLength={limits.label} value={field.label} onChange={event => updateField(field.id, { label: event.target.value })} /></label>
          <label>Content type<select value={field.type} onChange={event => updateField(field.id, { type: event.target.value,
            value: event.target.value === 'list' ? field.value.split('\n') : field.value.join('\n') })}>
            <option value="text">Text</option><option value="list">List</option></select></label>
          <label>{field.type === 'list' ? 'One item per line' : 'Content'}<textarea rows="3"
            maxLength={field.type === 'text' ? limits.text : limits.items * (limits.item + 1) - 1}
            value={field.type === 'list' ? field.value.join('\n') : field.value}
            onChange={event => updateField(field.id, { value: field.type === 'list' ? event.target.value.split('\n') : event.target.value })} /></label>
          <div className="identity-module__form-actions">
            <button type="button" disabled={index === 0} aria-label={`Move field ${index + 1} up`} onClick={() => moveField(index, -1)}><ArrowUp /></button>
            <button type="button" disabled={index === editor.card.fields.length - 1} aria-label={`Move field ${index + 1} down`} onClick={() => moveField(index, 1)}><ArrowDown /></button>
            <button type="button" aria-label={`Remove field ${index + 1}`} onClick={() => fields(editor.card.fields.filter(item => item.id !== field.id))}><Trash2 /></button>
          </div>
        </fieldset>)}
        <button type="button" disabled={editor.card.fields.length >= limits.fields} onClick={addField}>Add field</button>
        <small>Empty fields stay out of your published card.</small>{actions}
      </form> : <>
        {visibleFields.length > 0 ? <dl className="identity-module__fields">{visibleFields.map(field => <div key={field.id}>
          <dt>{field.label}</dt><dd>{field.type === 'list' ? <ul>{field.value.map((item, index) => <li key={index}>{item}</li>)}</ul> : field.value}</dd>
        </div>)}</dl> : onSave && <p>Add your own information fields.</p>}
      </>}
    </section>}
  </>;
}
