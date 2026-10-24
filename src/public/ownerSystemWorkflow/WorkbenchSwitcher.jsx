import { useLayoutEffect, useRef, useState } from 'react';
import { MAX_WORKBENCHES } from '../../systemWorkflow/domain/workbenchCollection.js';
import './workbenchSwitcher.css';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';

export default function WorkbenchSwitcher({ store, beforeChange, focusOnMount, hidden, navigationRef }) {
  const { locked } = useWorkbenchCamera();
  const selector = useRef(null), nameField = useRef(null);
  const [form, setForm] = useState(null), [name, setName] = useState(''), [error, setError] = useState('');
  const items = store.listWorkbenches(), id = store.getWorkbenchId();
  const current = items.find(item => item.id === id);
  useLayoutEffect(() => { if (focusOnMount) selector.current?.focus({ preventScroll: true }); }, [focusOnMount]);
  useLayoutEffect(() => { if (form) { nameField.current?.focus(); nameField.current?.select(); } }, [form]);
  const perform = action => {
    try {
      const workbench = beforeChange();
      if (!action(workbench)) throw new Error('Could not save the Workbench. Your current work is still open. Retry after storage is available.');
      setError('');
      return true;
    } catch (failure) { setError(failure.message); return false; }
  };
  const close = () => { setForm(null); setError(''); selector.current?.focus(); };
  return <section className="workbench-switcher" aria-label="Local Workbenches" hidden={hidden || locked}
    data-workflow-material="tactile" data-workflow-finish="flat" data-workbench-selection-tools>
    <div className="workbench-switcher__navigation" ref={navigationRef}>
    <div className="workbench-switcher__row">
      <label htmlFor="active-local-workbench">Workbench</label>
      <select id="active-local-workbench" ref={selector} aria-label="Active Workbench" value={id}
        onChange={event => { const next = event.target.value; perform(workbench => store.switchWorkbench(next, { workbench })); }}>
        {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <button className="workflow-tactile-control" type="button" aria-expanded={form === 'new'}
        disabled={items.length >= MAX_WORKBENCHES}
        onClick={() => { setName(`Workbench ${items.length + 1}`); setForm('new'); setError(''); }}>New</button>
      <button className="workflow-tactile-control" type="button" aria-expanded={form === 'rename'}
        onClick={() => { setName(current.name); setForm('rename'); setError(''); }}>Rename</button>
    </div>
    {store.isCollection() && <small>Saved locally · publishing multiple Workbenches comes later</small>}
    </div>
    {form && <form className="workbench-switcher__form" onSubmit={event => {
      event.preventDefault();
      if (perform(workbench => form === 'new' ? store.createWorkbench(name.trim(), { workbench }) : store.renameWorkbench(name.trim()))) close();
    }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }}>
      <label>{form === 'new' ? 'New Workbench name' : 'Workbench name'}
        <input ref={nameField} value={name} maxLength={64} required onChange={event => setName(event.target.value)} /></label>
      <div>
        <button className="workflow-tactile-control" type="submit">{form === 'new' ? 'Create Workbench' : 'Save name'}</button>
        <button className="workflow-tactile-control" type="button" onClick={close}>Cancel</button>
      </div>
      {form === 'new' && <small>Starts with an empty canvas. Library and Keeper remain shared.</small>}
    </form>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
