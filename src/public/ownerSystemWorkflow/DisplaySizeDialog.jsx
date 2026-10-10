import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DISPLAY_CANVAS_LIMITS, displayFormat } from '../../systemWorkflow/domain/displayModules.js';
import './displaySize.css';
import DisplayCanvasControls from './DisplayCanvasControls.jsx';

// Both creation and editing submit dimensions and appearance together. Typing is temporary;
// the caller's existing Display operation owns validation, saving and undo.
export default function DisplaySizeDialog({ geometry = { columns: 32, rows: 18 }, appearance, creating = false,
  onConfirm, onClose, returnFocus, menuSurface, error }) {
  const dialog = useRef(null), widthInput = useRef(null);
  const [width, setWidth] = useState(String(geometry.columns));
  const [height, setHeight] = useState(String(geometry.rows));
  const [initialAppearance] = useState(appearance);
  const [appearancePatch, setAppearancePatch] = useState({});
  const [failure, setFailure] = useState('');
  const title = creating ? 'Create Display' : 'Canvas size';
  useLayoutEffect(() => {
    const node = dialog.current;
    node.showModal(); widthInput.current?.select();
    return () => { node.close(); if (returnFocus?.isConnected) returnFocus.focus(); };
  }, [returnFocus]);
  return createPortal(<dialog ref={dialog} className="system-workflow__create-dialog system-workflow__display-size-dialog system-workflow__token-scope"
    data-lattice-menu-surface={menuSurface} aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
    <form noValidate onSubmit={event => {
      event.preventDefault();
      const size = { width: Number(width), height: Number(height) };
      try { displayFormat(size); } catch (cause) { setFailure(cause.message); return; }
      if (onConfirm(size, appearancePatch)) onClose();
      else setFailure('The Display settings could not be saved. Try again.');
    }}>
      <header>{title}</header>
      <div className="display-size-fields">
        <label>Width (units)<input ref={widthInput} autoFocus type="number" min={DISPLAY_CANVAS_LIMITS.minimum} max={DISPLAY_CANVAS_LIMITS.maximum}
          step="1" value={width} onChange={event => { setWidth(event.target.value); setFailure(''); }} /></label>
        <label>Height (units)<input type="number" min={DISPLAY_CANVAS_LIMITS.minimum} max={DISPLAY_CANVAS_LIMITS.maximum}
          step="1" value={height} onChange={event => { setHeight(event.target.value); setFailure(''); }} /></label>
      </div>
      <p>1–512 canvas units per side. All Grids share this size.</p>
      {!creating && <p>Content keeps its size and position. Rearrange it to fit; anything outside the canvas stays in your draft.</p>}
      <DisplayCanvasControls appearance={{ ...initialAppearance, ...appearancePatch }} onChange={patch => setAppearancePatch(current => ({ ...current, ...patch }))} />
      {(failure || error) && <p role="alert">{error || failure}</p>}
      <footer><button type="button" onClick={onClose}>Cancel</button><button type="submit">{creating ? 'Create' : 'Apply'}</button></footer>
    </form>
  </dialog>, document.body);
}
