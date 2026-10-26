import { useLayoutEffect, useRef, useState } from 'react';
import { MAX_WORKBENCHES } from '../../systemWorkflow/domain/workbenchCollection.js';
import './workbenchSwitcher.css';

export default function WorkbenchSwitcher({ items, activeId, isCollection, actions, focusOnMount, hidden, navigationRef, onOverview }) {
  const selector = useRef(null), nameField = useRef(null);
  const [form, setForm] = useState(null), [name, setName] = useState(''), [error, setError] = useState('');
  const current = items.find(item => item.id === activeId);
  const atLimit = items.length >= MAX_WORKBENCHES;
  useLayoutEffect(() => { if (focusOnMount) selector.current?.focus({ preventScroll: true }); }, [focusOnMount]);
  useLayoutEffect(() => { if (form) { nameField.current?.focus(); nameField.current?.select(); } }, [form]);
  const perform = action => {
    try {
      action();
      setError('');
      return true;
    } catch (failure) { setError(failure.message); return false; }
  };
  const close = () => { setForm(null); setError(''); selector.current?.focus(); };
  return <section className="workbench-switcher" aria-label="Local Workbenches" hidden={hidden}
    data-workflow-material="tactile" data-workflow-finish="flat" data-workbench-selection-tools>
    <div className="workbench-switcher__navigation" ref={navigationRef}>
    <div className="workbench-switcher__row">
      {onOverview && <button type="button" className="workflow-tactile-control" onClick={onOverview}>Overview</button>}
      <label htmlFor="active-local-workbench">Workbench</label>
      <select id="active-local-workbench" ref={selector} aria-label="Active Workbench" value={activeId}
        onChange={event => { const next = event.target.value; perform(() => actions.switchTo(next)); }}>
        {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <button className="workflow-tactile-control" type="button" aria-expanded={form === 'new'}
        disabled={atLimit} aria-describedby={atLimit ? 'workbench-status' : undefined}
        onClick={() => { setName(`Workbench ${items.length + 1}`); setForm('new'); setError(''); }}>New</button>
      <button className="workflow-tactile-control" type="button" aria-expanded={form === 'rename'}
        onClick={() => { setName(current.name); setForm('rename'); setError(''); }}>Rename</button>
    </div>
    {isCollection && <small id="workbench-status">{atLimit
      ? `Saved locally · all ${MAX_WORKBENCHES} Workbench slots are in use.`
      : 'Saved locally · publication unavailable'}</small>}
    </div>
    {form && <form className="workbench-switcher__form" onSubmit={event => {
      event.preventDefault();
      if (perform(() => form === 'new' ? actions.create(name) : actions.rename(name))) close();
    }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }}>
      <label>{form === 'new' ? 'New Workbench name' : 'Workbench name'}
        <input ref={nameField} value={name} maxLength={64} required onChange={event => setName(event.target.value)} /></label>
      <div>
        <button className="workflow-tactile-control" type="submit">{form === 'new' ? 'Create Workbench' : 'Save name'}</button>
        <button className="workflow-tactile-control" type="button" onClick={close}>Cancel</button>
      </div>
      {form === 'new' && <small>Empty canvas · shared Library and Keeper</small>}
    </form>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
