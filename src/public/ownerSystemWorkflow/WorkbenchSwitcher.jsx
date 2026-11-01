import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Eye, GripVertical, Settings2 } from 'lucide-react';
import ToolPanel from '../../ui/ToolPanel.jsx';
import { MAX_WORKBENCHES } from '../../systemWorkflow/domain/workbenchCollection.js';
import './workbenchSwitcher.css';

export default function WorkbenchSwitcher({ items, activeId, receptionAvailable = false, actions, focusOnMount, hidden, navigationRef, onOverview, onPreview, onSettings, positionPreferences, children }) {
  const position = useSyncExternalStore(positionPreferences.subscribe, positionPreferences.getSnapshot);
  const frame = { left: Math.max(12, innerWidth - 572), top: 12, ...position, width: Math.min(560, innerWidth - 24), height: 50 };
  const setFrame = change => {
    const next = typeof change === 'function' ? change(frame) : change;
    if (next.left !== frame.left || next.top !== frame.top) positionPreferences.update({ left: next.left, top: next.top });
  };
  const selector = useRef(null), nameField = useRef(null);
  const [form, setForm] = useState(null), [name, setName] = useState(''), [error, setError] = useState('');
  const current = items.find(item => item.id === activeId);
  const reception = activeId === 'reception';
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
  return <ToolPanel className="workbench-switcher" label="Editor documents" title="Editor documents" hidden={hidden}
    frame={frame} onFrameChange={setFrame} contentSized resizable={false} zIndex={form ? 92 : 90}
    data-workflow-material="tactile" data-workflow-finish="flat" data-workbench-selection-tools>
    {(_renderHeader, renderMoveHandle) => <><div className="workbench-switcher__navigation" ref={navigationRef} data-floating={position ? true : undefined}>
    <div className="workbench-switcher__row">
      {renderMoveHandle(<GripVertical aria-hidden="true" size={14} />, 'workbench-switcher__grip')}
      {onOverview && <button type="button" className="workflow-tactile-control" onClick={onOverview}>My Inscape</button>}
      <select id="active-local-workbench" ref={selector} aria-label="Active document" value={activeId}
        onChange={event => { const next = event.target.value; perform(() => actions.switchTo(next)); }}>
        {receptionAvailable && <option value="reception">Reception</option>}
        {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      {onSettings && <button className="workflow-tactile-control" type="button" aria-label="Settings" title="Settings"
        onClick={event => onSettings(event.currentTarget)}><Settings2 size={14} /></button>}
      {onPreview && <button className="workflow-tactile-control" type="button" onClick={event => onPreview(event.currentTarget)}><Eye size={14} />Preview</button>}
      {!reception && <><button className="workflow-tactile-control" type="button" aria-expanded={form === 'new'}
        disabled={atLimit} aria-describedby={atLimit ? 'workbench-status' : undefined}
        onClick={() => { setName(`Canvas ${items.length + 1}`); setForm('new'); setError(''); }}>New canvas</button>
      <button className="workflow-tactile-control" type="button" aria-expanded={form === 'rename'}
        onClick={() => { setName(current.name); setForm('rename'); setError(''); }}>Rename</button></>}
    </div>
    {!reception && atLimit && <small id="workbench-status">All {MAX_WORKBENCHES} local canvas slots are in use.</small>}
    </div>
    {children}
    {form && <form className="workbench-switcher__form" onSubmit={event => {
      event.preventDefault();
      if (perform(() => form === 'new' ? actions.create(name) : actions.rename(name))) close();
    }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }}>
      <label>{form === 'new' ? 'New canvas name' : 'Canvas name'}
        <input ref={nameField} value={name} maxLength={64} required onChange={event => setName(event.target.value)} /></label>
      <div>
        <button className="workflow-tactile-control" type="submit">{form === 'new' ? 'Create canvas' : 'Save name'}</button>
        <button className="workflow-tactile-control" type="button" onClick={close}>Cancel</button>
      </div>
      {form === 'new' && <small>Empty canvas · shared Library and Keeper</small>}
    </form>}
    {error && <p role="alert">{error}</p>}</>}
  </ToolPanel>;
}
