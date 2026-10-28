import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReceptionColourPanel from '../src/reception/ReceptionColourPanel.jsx';
import '../src/index.css';
import '../src/public/ownerSystemWorkflow/workflowTactile.css';
import '../src/public/ownerSystemWorkflow/workflowFlat.css';
import '../src/public/ownerSystemWorkflow/workbenchToolChrome.css';

function Fixture() {
  const [colors, setColors] = useState({ first: '#112233', second: '#445566' });
  const [target, setTarget] = useState('first'), [version, setVersion] = useState(0), [open, setOpen] = useState(true), [disabled, setDisabled] = useState(false);
  const current = useRef(version), writes = useRef([]); current.current = version;
  const save = patch => { writes.current.push({ target, ...patch }); setColors(value => ({ ...value, [target]: patch.color })); setVersion(value => value + 1); };
  globalThis.colourFixture = { colors, target, version, writes: writes.current };
  return <main className="system-workflow__token-scope workbench-tool-controls" data-lattice-menu-surface data-menu-surface="carbon" data-window-chrome="flat"
    style={{ padding: 24, color: 'var(--tactile-ink)', background: 'var(--tactile-face)', width: 340 }}>
    <div><button onClick={() => setTarget(value => value === 'first' ? 'second' : 'first')}>Switch target</button>
      <button onClick={() => setVersion(value => value + 1)}>Advance version</button>
      <button onClick={() => setDisabled(value => !value)}>Toggle disabled</button>
      <button onClick={() => setOpen(value => !value)}>{open ? 'Close color' : 'Open color'}</button></div>
    {open && <section aria-label="Color"><ReceptionColourPanel color={colors[target]} disabled={disabled} scopeKey={target}
      getVersion={() => current.current} onChange={save} onPreview={() => {}} /></section>}
  </main>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
