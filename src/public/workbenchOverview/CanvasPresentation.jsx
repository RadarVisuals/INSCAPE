import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Info, Tags, PanelRight, Maximize2, Minimize2, Pencil, X, Scan } from 'lucide-react';
import CanvasPresentationBackdrop from './CanvasPresentationBackdrop.jsx';
import WorkbenchOverviewPreview from './WorkbenchOverviewPreview.jsx';
import { OwnerSystemWorkflowMetadataContent } from '../ownerSystemWorkflow/OwnerSystemWorkflowMetadataModule.jsx';
import useCanvasPresentationMotion from './useCanvasPresentationMotion.js';
import { canvasArtworkSources, canvasDestinations } from './canvasPresentationModel.js';
import './canvasPresentation.css';

const chromeClass = part => `canvas-presentation-${part} canvas-presentation-chrome`;

function Reveal({ label, icon: Icon, active, onActivate, children }) {
  const [hovered, setHovered] = useState(false), [pinned, setPinned] = useState(false), [focused, setFocused] = useState(false);
  const button = useRef(null), open = active && (hovered || pinned || focused);
  useEffect(() => { if (!active) { setHovered(false); setPinned(false); setFocused(false); } }, [active]);
  return <div className="canvas-presentation-reveal" data-panel={label} data-open={open || undefined}
    onPointerEnter={event => { if (event.pointerType === 'mouse') { onActivate(); setHovered(true); } }} onPointerLeave={() => setHovered(false)}
    onFocus={event => { if (event.target.matches(':focus-visible')) { onActivate(); setFocused(true); } }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
    onKeyDown={event => { if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); button.current?.focus(); setHovered(false); setFocused(false); setPinned(false); } }}>
    <button ref={button} type="button" aria-label={label} title={label} aria-expanded={open}
      onClick={() => { onActivate(); setPinned(!pinned); if (pinned) { setHovered(false); setFocused(false); } }}><Icon size={16} aria-hidden="true" /></button>
    <section className="canvas-presentation-popover" aria-label={label} aria-hidden={!open} inert={open ? undefined : ''}>{children}</section>
  </div>;
}

export default function CanvasPresentation({ selected: openingWork, model: openingModel, collection, wrap, origin, onClose, onEdit, publishedWorks = false, initialDestinationId = null }) {
  const dialog = useRef(null), surface = useRef(null), closeButton = useRef(null), hideTimer = useRef(null);
  const backdrop = useRef(null);
  const tileViewer = publishedWorks && Boolean(origin?.closest('.workbench-overview-gallery'));
  const [browsedId, setBrowsedId] = useState(null);
  const [cardPosition, setCardPosition] = useState(0);
  const selected = collection?.find(item => item.id === browsedId) || openingWork;
  const model = selected === openingWork ? openingModel : selected.model;
  const canBrowse = tileViewer && collection?.length > 1;
  const position = canBrowse ? collection.findIndex(item => item.id === selected.id) : -1;
  const neighbor = step => {
    if (!canBrowse) return null;
    const index = position + step;
    return collection[wrap ? (index + collection.length) % collection.length : index];
  };
  const drag = useRef(null);
  const dither = publishedWorks && !tileViewer && typeof CSS !== 'undefined' && typeof CSS.registerProperty === 'function'
    && CSS.supports('opacity', 'round(down, .5, .125)') && CSS.supports('mask-image', 'url(#mask)');
  const [expanded, setExpanded] = useState(false), [destinationId, setDestinationId] = useState(initialDestinationId), [sourceId, setSourceId] = useState(null);
  const [error, setError] = useState('');
  const [reveal, setReveal] = useState(null);
  const [chromeVisible, setChromeVisible] = useState(false);
  const destinations = useMemo(() => canvasDestinations(selected.draft), [selected.draft]);
  const sources = useMemo(() => canvasArtworkSources(model), [model]);
  const [indexOpen, setIndexOpen] = useState(false);
  const showChrome = useCallback(() => {
    if (dialog.current?.dataset.closing) return;
    setChromeVisible(true); clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(function hide() {
      const node = surface.current;
      if (!node) return;
      if (node.querySelector('.canvas-presentation-reveal[data-open], .canvas-presentation-chrome:hover')
        || node.contains(document.activeElement) && document.activeElement.matches(':focus-visible')) {
        hideTimer.current = setTimeout(hide, 1800); return;
      }
      setChromeVisible(false);
    }, 1800);
  }, []);
  useEffect(() => () => clearTimeout(hideTimer.current), []);
  const destination = destinations.find(item => item.id === destinationId);
  const source = sources.find(item => item.id === sourceId);
  const choose = id => { if (id !== destinationId && beforeViewChange()) setDestinationId(id); if (innerWidth <= 800) setIndexOpen(false); };
  const { viewport, close, beforeViewChange } = useCanvasPresentationMotion({ dialog, surface, backdrop, dither, publishedWorks, origin, area: model.area,
    region: destination?.view || model.area, expanded, onClose, returnToOrigin: selected.id === openingWork.id });
  const slide = useRef(null);
  const resetSlide = useCallback(() => {
    slide.current?.cancel(); slide.current = null; drag.current = null;
    const node = dialog.current;
    if (node) {
      node.style.removeProperty('--quick-progress');
      delete node.dataset.travel;
    }
  }, []);
  useEffect(() => {
    window.addEventListener('resize', resetSlide);
    return () => { window.removeEventListener('resize', resetSlide); resetSlide(); };
  }, [resetSlide]);
  const browse = (step, commit = true) => {
    const next = neighbor(step), node = dialog.current;
    if (!next || expanded || slide.current || surface.current?.dataset.moving || node.dataset.closing) return;
    const progress = Number(node.style.getPropertyValue('--quick-progress')) || 0;
    node.dataset.travel = step > 0 ? 'Next' : 'Previous';
    const finish = () => {
      resetSlide();
      if (!commit) return;
      flushSync(() => {
        setBrowsedId(next.id); setCardPosition(current => current + step); setDestinationId(null); setSourceId(null);
        setIndexOpen(false); setReveal(null); setError('');
      });
      node.focus({ preventScroll: true });
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
    const end = commit ? 1 : 0;
    const animation = node.animate([{ '--quick-progress': progress }, { '--quick-progress': end }], {
      duration: Math.max(120, 420 * Math.abs(end - progress)), easing: 'cubic-bezier(.22,.68,.18,1)', fill: 'forwards',
    });
    slide.current = animation;
    animation.finished.then(() => { if (slide.current === animation) finish(); }).catch(() => {});
  };
  const endDrag = (event, commit) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    drag.current = null;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (!dialog.current.dataset.travel) return;
    event.stopPropagation();
    browse(dialog.current.dataset.travel === 'Next' ? 1 : -1, commit && Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy));
  };
  const dismiss = () => {
    const inTransit = Boolean(dialog.current.dataset.travel);
    if (inTransit) { slide.current?.pause(); drag.current = null; }
    close({ inTransit });
  };
  const edit = () => { try { onEdit(selected.id, surface.current); } catch (failure) { setError(failure.message); } };
  return <dialog className="canvas-presentation" ref={dialog} tabIndex={-1} aria-modal="true" aria-label={`View ${selected.name}`}
    data-tile-viewer={tileViewer || undefined} data-wide-preview={tileViewer && !expanded && model.area.width >= model.area.height * 1.25 || undefined} data-chrome-visible={chromeVisible || undefined}
    style={{ '--canvas-ratio': model.area.width / model.area.height }} data-expanded={expanded || undefined} onCancel={event => { event.preventDefault(); dismiss(); }}
    onKeyDown={event => {
      // Let the native modal cancel without also triggering the surrounding
      // overview's Escape action. Nested popovers consume their own Escape.
      if (event.key === 'Escape') { event.stopPropagation(); return; }
      if (canBrowse && !expanded && ['ArrowLeft', 'ArrowRight'].includes(event.key) && !event.target.closest('input, select, textarea, .canvas-presentation-chrome')) {
        event.preventDefault(); browse(event.key === 'ArrowRight' ? 1 : -1); return;
      }
      if (event.key === 'Tab') {
        if (!chromeVisible) { event.preventDefault(); requestAnimationFrame(() => closeButton.current?.focus()); }
        else {
          const controls = [...dialog.current.querySelectorAll('button, select, input, textarea, a[href]')]
            .filter(node => !node.disabled && !node.closest('[inert]') && getComputedStyle(node).visibility === 'visible');
          if (event.shiftKey && (event.target === controls[0] || event.target === dialog.current)) {
            event.preventDefault(); controls.at(-1)?.focus();
          } else if (!event.shiftKey && event.target === controls.at(-1)) {
            event.preventDefault(); controls[0]?.focus();
          }
        }
      }
      showChrome();
    }}
    onFocusCapture={event => { if (event.target !== dialog.current) showChrome(); }}
    onClick={event => { if (event.target === event.currentTarget) dismiss(); }}>
    <CanvasPresentationBackdrop backdropRef={backdrop} dither={dither} />
    {(canBrowse && !expanded ? [-1, 0, 1] : [0]).map(step => {
      const key = cardPosition + step;
      if (step) {
        const item = neighbor(step);
        if (!item) return null;
        const direction = step < 0 ? 'Previous' : 'Next';
        // Each card keeps its painted canvas as it moves between the edge and center.
        return <div key={key} className="quick-view-neighbor" data-side={direction} style={{ '--canvas-ratio': item.model.area.width / item.model.area.height }}>
          <div className="canvas-presentation-main" inert="" aria-hidden="true">
            <div className="canvas-presentation-stage" key="stage">
              <WorkbenchOverviewPreview model={item.model} name={item.name} presenting sidePreview />
            </div>
          </div>
          <button className="quick-view-neighbor-action" type="button" aria-label={direction + ' artwork: ' + item.name} onClick={() => browse(step)} />
        </div>;
      }
      return <div key={key} className="canvas-presentation-surface" data-ready={browsedId ? true : undefined} ref={surface} data-index-open={indexOpen || undefined}
        onPointerMove={event => { if (event.pointerType === 'mouse' && !drag.current) showChrome(); }}
        onPointerUp={event => {
          if (event.pointerType === 'mouse' || event.target.closest('.canvas-presentation-chrome')) return;
          if (chromeVisible) { setChromeVisible(false); setReveal(null); dialog.current?.focus({ preventScroll: true }); }
          else showChrome();
        }}>
        <div className="canvas-presentation-main">
          <header className={chromeClass('heading')} inert={chromeVisible ? undefined : ''}><span>{selected.name}</span>
            <div><button type="button" aria-label={expanded ? 'Return to modal' : 'Expand canvas'} title={expanded ? 'Return to modal' : 'Expand canvas'}
              onClick={() => { if (beforeViewChange()) setExpanded(!expanded); }}>{expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
              <button ref={closeButton} type="button" aria-label="Close canvas" title="Close canvas" onClick={dismiss}><X size={16} /></button></div>
          </header>
          <div className="canvas-presentation-stage" key="stage" data-browsable={canBrowse && !expanded || undefined}
            onPointerDown={event => {
              if (!canBrowse || expanded || slide.current || event.button !== 0 || !event.isPrimary || surface.current.dataset.moving
                || event.target.closest('a, button, input, textarea, select, [contenteditable="true"]')) return;
              const edge = dialog.current.querySelector('.quick-view-neighbor');
              const box = edge.getBoundingClientRect();
              const peek = edge.dataset.side === 'Previous' ? box.right : dialog.current.clientWidth - box.left;
              drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY,
                distance: dialog.current.clientWidth / 2 + surface.current.offsetWidth * (box.width / edge.offsetWidth) / 2 - peek };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={event => {
              if (drag.current?.id !== event.pointerId) return;
              const dx = event.clientX - drag.current.x;
              if (!dialog.current.dataset.travel && Math.abs(dx) < 5) return;
              const step = dx < 0 ? 1 : -1;
              if (!neighbor(step) || Math.abs(dx) < Math.abs(event.clientY - drag.current.y)) {
                delete dialog.current.dataset.travel; dialog.current.style.removeProperty('--quick-progress'); return;
              }
              dialog.current.dataset.travel = step === 1 ? 'Next' : 'Previous';
              const distance = drag.current.distance;
              dialog.current.style.setProperty('--quick-progress', Math.min(1, Math.abs(dx) / distance));
            }} onPointerUp={event => endDrag(event, true)} onPointerCancel={event => endDrag(event, false)}
            onLostPointerCapture={event => endDrag(event, false)} onDragStart={event => { if (canBrowse) event.preventDefault(); }}>
            <WorkbenchOverviewPreview model={model} name={selected.name}
              viewport={viewport} region={destination?.view || model.area} highlights={source?.frames} presenting />
          </div>
          <footer className={chromeClass('footer')} inert={chromeVisible ? undefined : ''}>
            {onEdit && <button type="button" className="canvas-presentation-edit" aria-label="Edit canvas" title="Edit canvas" onClick={edit}><Pencil size={15} /><span>Edit</span></button>}
            <div className="canvas-presentation-controls">
              <div className="canvas-presentation-tools">
                <Reveal label="Canvas details" icon={Info} active={reveal === 'canvas'} onActivate={() => setReveal('canvas')}>
                  <h2>{selected.name}</h2><p>{selected.introduction || 'No description yet.'}</p>
                  <dl><div><dt>Canvas</dt><dd>{model.area.width} × {model.area.height}</dd></div><div><dt>Contains</dt><dd>{model.contains}</dd></div></dl>
                </Reveal>
                <Reveal label="Artwork info" icon={Tags} active={reveal === 'artwork'} onActivate={() => setReveal('artwork')}>
                  <label className="canvas-presentation-source">Artwork<select aria-label="Artwork source" value={source?.id || ''} onChange={event => setSourceId(event.target.value || null)}>
                    <option value="">Choose a piece</option>{sources.map(item => <option key={item.id} value={item.id}>{item.name}{item.frames.length > 1 ? ` (${item.frames.length} placements)` : ''}</option>)}
                  </select></label>
                  {source ? <>{source.dossier ? <OwnerSystemWorkflowMetadataContent dossier={source.dossier} /> : <p>Source information is currently unavailable for this piece.</p>}
                    <button type="button" onClick={() => setSourceId(null)}>Clear highlight</button></>
                    : <p>{sources.length ? 'Choose a piece to see its creator, description, attributes and source.' : 'No artwork sources in this composition.'}</p>}
                </Reveal>
                <button type="button" title="Camera index" aria-label="Camera index" aria-expanded={indexOpen} onClick={() => setIndexOpen(!indexOpen)}><PanelRight size={16} /></button>
              </div>
              <nav className="canvas-presentation-views" aria-label="Camera points">
                <button type="button" title="Complete canvas" aria-label="Complete canvas" aria-pressed={!destination} onClick={() => choose(null)}><Scan size={14} /></button>
                {destinations.map((item, index) => <button key={item.id} type="button" title={item.name} aria-label={`View ${item.name}`}
                  aria-pressed={destinationId === item.id} onClick={() => choose(item.id)}>{String(index + 1).padStart(2, '0')}</button>)}
              </nav>
            </div>
          </footer>
          {error && <p role="alert" className="canvas-presentation-error">{error}</p>}
        </div>
        <aside className={chromeClass('index')} inert={indexOpen && chromeVisible ? undefined : ''} aria-label="Camera index" aria-hidden={!indexOpen || !chromeVisible} data-open={indexOpen || undefined}>
          <header><h2>Index</h2><button type="button" aria-label="Close index" title="Close index" onClick={() => setIndexOpen(false)}><X size={16} /></button></header>
          <nav aria-label="Saved camera views"><button type="button" aria-current={!destination ? 'true' : undefined} onClick={() => choose(null)}><Scan size={16} />Complete canvas</button>
            {destinations.map((item, index) => <button key={item.id} type="button" aria-current={destinationId === item.id ? 'true' : undefined} onClick={() => choose(item.id)}>
              <small>{String(index + 1).padStart(2, '0')}</small><span>{item.name}</span></button>)}
          </nav>
          {!destinations.length && <p>Save named camera views from the editor’s Index to show them here.</p>}
        </aside>
      </div>;
    })}
  </dialog>;
}
