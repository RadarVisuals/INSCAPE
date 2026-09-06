import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { PictureInPicture2, X } from 'lucide-react';
import DisplayInstrumentWindow from './DisplayInstrumentWindow.jsx';

const names = { layers: 'Layers', metadata: 'Metadata' };

export default function DisplayInstruments({ state, dispatch, projection, scope, selectionLabel, renderLayers, renderMetadata, overlayTop }) {
  const tabs = useRef({});
  const active = state.active;
  const content = (instrument) => instrument === 'layers' ? renderLayers() : renderMetadata();
  const returnToTrigger = (instrument) => requestAnimationFrame(() =>
    document.querySelector(`[data-instrument-trigger="${instrument}"]`)?.focus({ preventScroll: true }));
  const command = (type, instrument) => { dispatch({ type, instrument }); returnToTrigger(instrument); };
  const switchTab = (event, instrument) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const next = event.key === 'Home' ? 'layers' : event.key === 'End' ? 'metadata'
      : instrument === 'layers' ? 'metadata' : 'layers';
    dispatch({ type: 'open', instrument: next });
    tabs.current[next]?.focus();
  };
  return <>
    {active && <aside aria-label="Display Module instruments" className="system-workflow__instrument-bay"
      data-projection={projection} style={{ '--instrument-overlay-top': `${overlayTop}px` }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault(); event.stopPropagation(); command('toggle', active);
        }
      }}>
      <header className="system-workflow__instrument-rail">
        <div role="tablist" aria-label="Display Module instruments">{Object.entries(names).map(([id, name]) =>
          <button key={id} role="tab" id={`display-tab-${id}`} aria-controls={`display-panel-${id}`}
            aria-selected={active === id} tabIndex={active === id ? 0 : -1} ref={(node) => { tabs.current[id] = node; }}
            onClick={() => dispatch({ type: 'open', instrument: id })} onKeyDown={(event) => switchTab(event, id)}
            type="button">{name}{state[id] === 'detached' ? ' ↗' : ''}</button>)}</div>
        <button aria-label={`Detach ${names[active]}`} title={`Detach ${names[active]}`} className="system-workflow__round-control"
          onClick={() => command('detach', active)} type="button"><PictureInPicture2 /></button>
        <button aria-label="Close instrument bay" title="Close instrument bay" className="system-workflow__round-control"
          onClick={() => command('toggle', active)} type="button"><X /></button>
      </header>
      <small className="system-workflow__instrument-scope">Display Module · {scope}
        {active === 'metadata' && <span>{selectionLabel}</span>}</small>
      {Object.keys(names).map((id) => <div key={id} role="tabpanel" id={`display-panel-${id}`}
        aria-labelledby={`display-tab-${id}`} hidden={active !== id}
        className="system-workflow__instrument-content">{active === id ? content(id) : null}</div>)}
    </aside>}
    {Object.keys(names).filter((id) => state[id] === 'detached').map((id) => createPortal(
      <DisplayInstrumentWindow key={id} instrument={id}
        title={`Display Module / ${scope}${id === 'metadata' ? ` / ${selectionLabel}` : ''}`}
        onAttach={() => command('attach', id)} onClose={() => command('close', id)}>{content(id)}</DisplayInstrumentWindow>,
      document.querySelector('.system-workflow'), id))}
  </>;
}
