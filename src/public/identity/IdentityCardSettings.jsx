import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { IDENTITY_CARD_LIMITS as limits, isValidIdentityCard, projectIdentityCard, resolveIdentityCard } from '../../profileIdentity/domain/identityCard.js';

// One temporary edit session shared by the hero and its cells. No draft writes until Save.
export function useIdentityEditor({ card, profile, avatar, configured, onSave, onDone }) {
  const [editor, setEditor] = useState(null);
  const [error, setError] = useState(null);
  const session = useRef(null);
  const start = () => {
    const initial = { card: structuredClone(card), avatar: structuredClone(avatar), profile: {
      title: profile?.title || '', description: profile?.description || '', tags: profile?.tags || [],
    } };
    session.current = { initial, save: onSave, configured };
    setEditor({ ...initial, tagsText: initial.profile.tags.join(', ') }); setError(null);
    return initial;
  };
  const cancel = () => { setEditor(null); setError(null); session.current = null; onDone(); };
  const save = () => {
    if (!editor || !session.current) return;
    const next = { card: editor.card, avatar: editor.avatar, profile: { ...editor.profile, title: editor.profile.title.trim(),
      description: editor.profile.description.trim(),
      tags: [...new Set(editor.tagsText.split(',').map(tag => tag.trim()).filter(Boolean))] } };
    if (!isValidIdentityCard(next.card) || next.profile.tags.length > 16 || next.profile.tags.some(tag => tag.length > 48)) {
      setError('Check field limits and use up to 16 tags of at most 48 characters.'); return;
    }
    if (session.current.configured && JSON.stringify(next) === JSON.stringify(session.current.initial)) { cancel(); return; }
    if (session.current.save(next)) cancel();
    else setError('Could not save. Your changes are still here. If Identity changed elsewhere, cancel and reopen Edit.');
  };
  return { editor, error, start, cancel, save,
    setAvatar: value => {
      const current = editor || { ...start(), tagsText: (profile?.tags || []).join(', ') };
      setEditor({ ...current, avatar: value, card: !editor && !configured
        ? { ...current.card, background: resolveIdentityCard({ avatar: value }).background } : current.card });
    },
    setProfile: update => setEditor(current => ({ ...current, profile: { ...current.profile, ...update } })),
    setTags: tagsText => setEditor(current => ({ ...current, tagsText })),
    setCard: update => setEditor(current => ({ ...current, card: { ...current.card, ...update } })),
  };
}

function InlineText({ value, onChange, ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const node = ref.current;
    node.style.height = 'auto';
    node.style.height = Math.min(280, node.scrollHeight) + 'px';
  }, [value]);
  return <textarea ref={ref} rows={1} value={value} onChange={onChange} {...props} />;
}

export function IdentityProfileEditor({ edit, official, children }) {
  const { editor, setProfile, setTags } = edit;
  const titleRef = useRef(null);
  useLayoutEffect(() => { titleRef.current?.focus({ preventScroll: true }); }, []);
  return <>
    <input ref={titleRef} className="identity-module__inline identity-module__custom-title" aria-label="Custom title" placeholder="Add a title"
      maxLength={80} value={editor.profile.title} onChange={event => setProfile({ title: event.target.value })} />
    <h2>{official.name}</h2>
    {children}
    <InlineText className="identity-module__inline identity-module__bio" aria-label="Custom bio"
      placeholder={official.description || 'Add your bio'} maxLength={480} value={editor.profile.description}
      onChange={event => setProfile({ description: event.target.value.replace(/[\r\n]+/g, ' ') })} />
    <small className="identity-module__edit-hint">Leave bio empty to use the official bio.</small>
    {official.tags?.length > 0 && <ul aria-label="Profile tags">{official.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>}
    <input className="identity-module__inline identity-module__tags-input" aria-label="Tags, separated by commas"
      placeholder="Add interests, separated by commas" maxLength={798} value={editor.tagsText} onChange={event => setTags(event.target.value)} />
  </>;
}

export function IdentityFields({ card, edit }) {
  const fields = edit ? card.fields : projectIdentityCard(card).fields;
  const updateField = (id, update) => edit.setCard({ fields: fields.map(field => field.id === id ? { ...field, ...update } : field) });
  const move = (index, offset) => {
    const next = [...fields]; [next[index], next[index + offset]] = [next[index + offset], next[index]];
    edit.setCard({ fields: next });
  };
  const add = () => edit.setCard({ fields: [...fields, { id: `field:${crypto.randomUUID()}`, label: '', type: 'text', value: '' }] });
  return <dl className="identity-module__fields" aria-label="Identity fields">{fields.map((field, index) =>
    <div key={field.id} className="identity-module__cell">
      <dt>{edit ? <input className="identity-module__inline" aria-label={`Field ${index + 1} name`} placeholder="Field name"
        maxLength={limits.label} value={field.label} onChange={event => updateField(field.id, { label: event.target.value })} /> : field.label}</dt>
      <dd>{edit ? <InlineText className="identity-module__inline" aria-label={`Field ${index + 1} content`}
        placeholder={field.type === 'list' ? 'One item per line' : 'Write here'}
        maxLength={field.type === 'text' ? limits.text : limits.items * (limits.item + 1) - 1}
        value={field.type === 'list' ? field.value.join('\n') : field.value}
        onChange={event => updateField(field.id, { value: field.type === 'list' ? event.target.value.split('\n') : event.target.value })} />
        : field.type === 'list' ? <ul>{field.value.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul> : field.value}</dd>
      {edit && <div className="identity-module__cell-actions">
        <select aria-label={`Field ${index + 1} content type`} value={field.type} onChange={event => updateField(field.id, {
          type: event.target.value, value: event.target.value === 'list' ? field.value.split('\n') : field.value.join('\n'),
        })}><option value="text">Text</option><option value="list">List</option></select>
        <button type="button" disabled={index === 0} aria-label={`Move field ${index + 1} up`} onClick={() => move(index, -1)}><ArrowUp /></button>
        <button type="button" disabled={index === fields.length - 1} aria-label={`Move field ${index + 1} down`} onClick={() => move(index, 1)}><ArrowDown /></button>
        <button type="button" aria-label={`Remove field ${index + 1}`} onClick={() => edit.setCard({ fields: fields.filter(item => item.id !== field.id) })}><Trash2 /></button>
      </div>}
    </div>)}
    {edit && <div className="identity-module__add-cell"><dt><button type="button" onClick={add} disabled={fields.length >= limits.fields}
      aria-label="Add field"><Plus /><span>Add cell</span></button></dt></div>}
  </dl>;
}

export function IdentityAppearanceSettings({ edit, children }) {
  const background = update => edit.setCard({ background: { ...edit.editor.card.background, ...update } });
  const value = edit.editor.card.background;
  return <details className="identity-module__appearance"><summary>Appearance &amp; artwork</summary>
    <div className="identity-module__appearance-controls">
      <label>Background style<select value={value.type} onChange={event => background({ type: event.target.value })}>
        <option value="plain">Plain</option><option value="clouds">Clouds</option></select></label>
      {value.type === 'clouds' && <>
        <label className="identity-module__checkbox"><input type="checkbox" checked={value.color === null}
          onChange={event => background({ color: event.target.checked ? null : '#b6b6b6' })} />Theme cloud color</label>
        {value.color !== null && <label>Cloud color<input type="color" value={value.color} onChange={event => background({ color: event.target.value })} /></label>}
        <label>Movement speed<input type="range" min="0" max="2" step="0.1" aria-label="Cloud movement speed"
          value={value.speed} onChange={event => background({ speed: Number(event.target.value) })} /></label>
      </>}
      {children}
    </div>
  </details>;
}
