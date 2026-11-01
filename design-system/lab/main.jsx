import { Component, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import InterfaceThemeToggle from '../../src/InterfaceThemeToggle.jsx';
import { interfaceTheme, useInterfaceTheme } from '../../src/interfaceTheme.js';
import { describeElement } from './context.js';
import '../../src/inscapeTokens.css';
import '../../src/lattice/rendering/latticeMenuSurface.css';
import '../../src/public/ownerSystemWorkflow/ownerSystemWorkflow.css';
import '../referenceTokens.css';
import '../../src/public/ownerSystemWorkflow/workflowFlat.css';
import '../referenceMaterial.css';
import '../reference.css';
import '../toolbarPreview.css';
import '../propertiesPreview.css';
import './lab.css';

const loaders = Object.fromEntries(Object.entries(import.meta.glob(['./artboards/*.jsx', './experiments/*.jsx']))
  .map(([path, load]) => [path.slice(2, -4), load]));
const params = new URLSearchParams(location.search);
const artboard = params.get('artboard') || 'artboards/reception';
const frame = params.has('frame');
if (['dark', 'light'].includes(params.get('theme'))) interfaceTheme.setMode(params.get('theme'));
const requestedWidth = Number(params.get('width'));
const initialWidth = Number.isInteger(requestedWidth) && requestedWidth >= 320 && requestedWidth <= 1920 ? requestedWidth : 1440;
const label = key => key.split('/').at(-1).replaceAll('-', ' ');

class ArtboardBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error: error.message }; }
  render() { return this.state.error ? <p role="alert">Artboard failed: {this.state.error}. Fix the experiment and use Reset.</p> : this.props.children; }
}

function DesignLab() {
  const { mode: theme } = useInterfaceTheme();
  const [loaded, setLoaded] = useState(null), [error, setError] = useState(null), [reset, setReset] = useState(0);
  const [width, setWidth] = useState(initialWidth), [inspect, setInspect] = useState(false), [selection, setSelection] = useState(null);
  const [notice, setNotice] = useState(''), selectedNode = useRef(null);
  useEffect(() => {
    let active = true;
    if (!loaders[artboard]) { setError('This artboard does not exist. Choose another example.'); return; }
    loaders[artboard]().then(module => { if (active) setLoaded(module); }, problem => { if (active) setError(problem.message); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const url = new URL(location.href); url.searchParams.set('width', String(width)); url.searchParams.set('theme', theme); history.replaceState(null, '', url);
  }, [width, theme]);
  useEffect(() => {
    if (!inspect) return;
    const choose = event => {
      if (event.type === 'keydown' && event.key !== 'Enter') return;
      if (event.target.closest('[data-lab-chrome]')) return;
      const node = event.target.closest('[data-inscape-source]');
      if (!node) return;
      event.preventDefault(); event.stopPropagation();
      // Opening the inspector can move the layout before pointerup/click.
      // Keep the element chosen at pointerdown instead of inspecting its replacement.
      if (event.type === 'pointerup' || event.type === 'click') return;
      selectedNode.current?.removeAttribute('data-lab-inspected');
      selectedNode.current = node; node.setAttribute('data-lab-inspected', '');
      setSelection(describeElement(node)); setNotice('');
    };
    const escape = event => { if (event.key === 'Escape') setInspect(false); };
    document.addEventListener('click', choose, true);
    document.addEventListener('pointerdown', choose, true);
    document.addEventListener('pointerup', choose, true);
    document.addEventListener('keydown', choose, true);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('click', choose, true); document.removeEventListener('keydown', choose, true);
      document.removeEventListener('pointerdown', choose, true); document.removeEventListener('pointerup', choose, true);
      document.removeEventListener('keydown', escape); selectedNode.current?.removeAttribute('data-lab-inspected');
    };
  }, [inspect]);
  const Canvas = loaded?.default;
  const context = JSON.stringify({ artboard, url: location.href, theme,
    adapter: `design-system/lab/${artboard}.jsx`, sources: loaded?.sources, selection }, null, 2);
  const changeArtboard = event => { const url = new URL(location.href); url.searchParams.set('artboard', event.target.value); location.assign(url); };
  const resetArtboard = () => {
    try { loaded?.resetSample?.(); }
    catch { setNotice('The sample could not be reset. Your saved sample is still available.'); return; }
    selectedNode.current?.removeAttribute('data-lab-inspected'); setSelection(null); setInspect(false); setReset(value => value + 1);
  };
  return <div className="lab system-workflow__token-scope" data-lattice-menu-surface data-workflow-material="tactile" data-workflow-finish="flat">
    {!frame && <header className="lab-header" data-lab-chrome>
      <div className="lab-heading"><h1>INSCAPE <span>Design lab</span></h1><InterfaceThemeToggle /></div>
      <div className="lab-controls">
        <label>Artboard<select aria-label="Artboard" value={artboard} onChange={changeArtboard}>
          {!loaders[artboard] && <option value={artboard}>Unknown artboard</option>}
          {['artboards', 'experiments'].map(group => <optgroup key={group} label={group === 'artboards' ? 'Live components' : 'Experiments'}>
            {Object.keys(loaders).filter(key => key.startsWith(group + '/')).map(key => <option key={key} value={key}>{label(key)}</option>)}
          </optgroup>)}
        </select></label>
        <label>Width<select aria-label="Artboard width" value={width} onChange={event => setWidth(Number(event.target.value))}>
          {[...new Set([390, 1024, 1440, 1920, width])].sort((a, b) => a - b).map(value => <option key={value} value={value}>{value} px</option>)}
        </select></label>
        <button onClick={resetArtboard}>Reset</button>
        <button aria-pressed={inspect} onClick={() => setInspect(value => !value)}>Inspect source</button>
        <a href={`?${new URLSearchParams({ artboard, width: String(width), theme, frame: '1' })}`} target="_blank" rel="noreferrer">Open canvas ↗</a>
        <a href="/design-system.html" target="_blank" rel="noreferrer">Design system ↗</a>
      </div>
      <p>{loaded?.description || 'Loading artboard…'}</p>
      <p className="lab-note">Local examples · Reset restores the sample. Edit experiment files to keep a variation.</p>
    </header>}
    {inspect && <aside className="lab-inspector" data-lab-chrome aria-label="Source inspector">
      <p>Click an element, or focus it and press Enter. Escape returns to interaction.</p>
      {selection && <><strong>{selection.owner} · {selection.source}</strong>
        <textarea aria-label="Selected component context" readOnly value={context} rows={8} />
        <button onClick={async () => { try { await navigator.clipboard.writeText(context); setNotice('Context copied.'); } catch { setNotice('Copy unavailable. Select the context text and copy it.'); } }}>Copy context</button>
      </>}
      <span role="status">{notice}</span>
    </aside>}
    <main className="lab-viewport" aria-label="Artboard viewport">
      <div className="lab-artboard" data-lab-artboard={artboard} data-lab-ready={Boolean(Canvas)} style={{ width: frame || loaded?.fullViewport ? '100%' : width, padding: loaded?.edgeToEdge ? 0 : undefined }}>
        {error ? <p role="alert">{error}</p> : Canvas ? <ArtboardBoundary key={reset}><Canvas width={width} /></ArtboardBoundary> : <p role="status">Loading component…</p>}
      </div>
    </main>
    {!frame && <footer className="lab-footer" data-lab-chrome>
      <code>npm run design:new -- my-study --from {artboard.startsWith('artboards/') ? artboard.split('/').at(-1) : 'reception'}</code>
      <span>Experiments use the real components. Changes to shared source affect every artboard.</span>
    </footer>}
  </div>;
}

export function mount(container) { createRoot(container).render(<DesignLab />); }
