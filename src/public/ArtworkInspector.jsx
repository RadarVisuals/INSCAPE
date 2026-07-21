import { useEffect, useRef, useState } from 'react';
import { CANVAS_OBJECT_ORDER_COMMAND } from '../library/domain/canvasObjects.js';
import { getCanvasObjectDefinition } from '../library/domain/canvasObjectRegistry.js';
import { clampMenuPosition } from './menus/contextMenuModel.js';
export default function ArtworkInspector({ object, assetName, anchor, onPresentation, onGeometry, onVisibility, onReplace, onReorder, onRemove, onClose }) {
  const ref = useRef(null); const closeRef = useRef(onClose); const definition = getCanvasObjectDefinition(object.kind);
  const dragRef = useRef(null); const [position, setPosition] = useState(anchor);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => { setPosition(anchor); }, [anchor, object.id]);
  useEffect(() => { ref.current?.querySelector('select')?.focus(); const key = (event) => { if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); } }; const outside = (event) => { if (!ref.current?.contains(event.target) && !event.target.closest?.(`[data-canvas-object-id="${object.id}"]`)) closeRef.current(); }; window.addEventListener('keydown', key); window.addEventListener('pointerdown', outside, true); return () => { window.removeEventListener('keydown', key); window.removeEventListener('pointerdown', outside, true); }; }, [object.id]);
  const beginDrag = (event) => {
    if (globalThis.innerWidth < 720 || event.target.closest('button') || event.pointerType === 'mouse' && event.button !== 0) return;
    const rect = ref.current.getBoundingClientRect();
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    event.currentTarget.setPointerCapture?.(event.pointerId); event.preventDefault();
  };
  const moveDrag = (event) => {
    const drag = dragRef.current; if (!drag || drag.pointerId !== event.pointerId) return;
    const rect = ref.current.getBoundingClientRect();
    setPosition(clampMenuPosition({ x: drag.left + event.clientX - drag.x, y: drag.top + event.clientY - drag.y }, rect, { width: globalThis.innerWidth, height: globalThis.innerHeight }));
  };
  const finishDrag = (event) => { if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null; };
  return <aside ref={ref} className="artwork-inspector" role="dialog" aria-label={`Edit framed artwork: ${assetName}`} style={position ? { left: position.x, top: position.y } : undefined}><header onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={finishDrag}><div><small>Framed artwork</small><strong>{assetName}</strong></div><button type="button" onClick={onClose} aria-label="Close artwork inspector">×</button></header>
    <div className="artwork-inspector__fields"><label>Image fit<select value={object.presentation.fit} onChange={(event) => onPresentation({ fit: event.target.value })}><option value="contain">Contain</option><option value="cover">Cover</option></select></label><label>Frame<select value={object.presentation.frame} onChange={(event) => onPresentation({ frame: event.target.value })}><option value="none">None</option><option value="thin">Thin</option><option value="heavy">Heavy</option></select></label><label>Mat<select value={object.presentation.mat} onChange={(event) => onPresentation({ mat: event.target.value })}><option value="none">None</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label>Background<select value={object.presentation.background} onChange={(event) => onPresentation({ background: event.target.value })}><option value="dark">Dark</option><option value="light">Light</option><option value="neutral">Neutral</option></select></label><label>Width<input type="number" aria-label="Artwork width in cells" min={definition.minimumSpan.columns} max={definition.maximumSpan.columns} value={object.span.columns} onChange={(event) => onGeometry({ ...object.span, columns: Number(event.target.value) })} /></label><label>Height<input type="number" aria-label="Artwork height in cells" min={definition.minimumSpan.rows} max={definition.maximumSpan.rows} value={object.span.rows} onChange={(event) => onGeometry({ ...object.span, rows: Number(event.target.value) })} /></label></div>
    <button type="button" aria-pressed={object.visitorVisible} onClick={onVisibility}>{object.visitorVisible ? 'Make private' : 'Show to visitors'}</button><button type="button" onClick={onReplace}>Replace Artwork</button>
    <fieldset><legend>Layer</legend><div className="artwork-inspector__layer"><button type="button" onClick={() => onReorder(CANVAS_OBJECT_ORDER_COMMAND.FRONT)}>Bring to Front</button><button type="button" onClick={() => onReorder(CANVAS_OBJECT_ORDER_COMMAND.BACK)}>Send to Back</button></div></fieldset>
    <button type="button" className="artwork-inspector__remove" onClick={onRemove}>Remove from Canvas (asset stays in library)</button>
  </aside>;
}
