import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye } from '../public/InscapeIcons.jsx';
import DisplayTextContent from '../public/ownerSystemWorkflow/DisplayTextContent.jsx';
import { displayTextArticle } from '../systemWorkflow/domain/displayText.js';
import { detachTextFromDisplay, saveDisplayArticleResult } from './textTransfer.js';
import TextTools from './TextTools.jsx';
import { textRecoveryScope, readTextRecovery, retainTextRecovery, clearTextRecovery } from './textEditRecovery.js';
import TextMoveHandle from './TextMoveHandle.jsx';
const ArticleEditor = lazy(() => import('./ArticleEditor.jsx'));

export default function DisplayArticleEditor({ placement, controller, cellSize, screenCellSize, canvasRef, onClose }) {
  const scope = textRecoveryScope(controller.draft.profileAddress, placement.id, controller.moduleId, controller.selectedGridId);
  const recovered = readTextRecovery(controller.store, scope);
  const [article, setArticle] = useState(() => recovered?.value || displayTextArticle(placement.text)), [host, setHost] = useState(null), [error, setError] = useState(recovered?.failure.message || '');
  const expected = useRef(recovered?.expected || placement), failed = useRef(Boolean(recovered)), working = useRef(article); working.current = article;
  const [reason, setReason] = useState(recovered?.failure.reason || null);
  const root = useRef(null), [actions, setActions] = useState({ top: 56, right: 8 });
  useLayoutEffect(() => {
    const bounds = root.current.getBoundingClientRect(), canvas = canvasRef.current.getBoundingClientRect();
    const board = canvasRef.current.closest('.system-workflow__presentation-board')?.getBoundingClientRect() || canvas;
    const scale = screenCellSize / cellSize;
    setActions({ top: Math.max(8, (Math.max(board.top + 56, canvas.top + 8) - bounds.top) / scale), right: Math.max(8, (bounds.right - canvas.right + 8) / scale) });
  }, [placement.column, placement.row, placement.columnSpan, placement.rowSpan, screenCellSize, cellSize]);
  useEffect(() => { if (!failed.current) { expected.current = placement; setArticle(displayTextArticle(placement.text)); } }, [placement]);
  const save = (next, options) => {
    setArticle(next); working.current = next;
    const result = saveDisplayArticleResult(controller.store, controller.draft.profileAddress, { moduleId: controller.moduleId, gridId: controller.selectedGridId, expected: expected.current, article: next }, options);
    setReason(result.reason || null);
    if (!result.saved) { failed.current = true; retainTextRecovery(controller.store, scope, expected.current, next, result); setError(result.message); return false; }
    clearTextRecovery(controller.store, scope);
    expected.current = result.record; failed.current = false; setError(''); return true;
  };
  const detach = rectangle => {
    if (!save(working.current)) return;
    detachTextFromDisplay(controller.store, controller.draft.profileAddress, { moduleId: controller.moduleId, gridId: controller.selectedGridId,
      expected: expected.current, cellSize: screenCellSize, window: {
        left: Math.max(8, rectangle.left), top: Math.max(8, rectangle.top), width: Math.max(240, rectangle.width), height: Math.max(180, rectangle.height),
      } });
  };
  const outside = point => { const bounds = canvasRef.current?.getBoundingClientRect(); return bounds && (point.x < bounds.left || point.x > bounds.right || point.y < bounds.top || point.y > bounds.bottom); };
  const detachBeside = () => {
    const bounds = canvasRef.current?.getBoundingClientRect(); if (!bounds) return;
    try { detach({ left: bounds.right + 12, top: bounds.top, width: placement.columnSpan * screenCellSize, height: placement.rowSpan * screenCellSize }); }
    catch (failure) { setError(failure.message); }
  };
  const close = () => { if (failed.current) return; onClose(); };
  return <div ref={root} className="text-workbench display-text-authoring">
    <DisplayTextContent placement={{ ...placement, text: { article } }} cellSize={cellSize}>
      <Suspense fallback={<p role="status">Opening editor…</p>}><ArticleEditor article={article} onChange={save} controlsHost={host} disabled={placement.locked} /></Suspense>
    </DisplayTextContent>
    <div className="display-text-edit-actions" style={actions}>
      <TextMoveHandle label="Drag Text out of Display" disabled={placement.locked} previewAt={(point, rectangle) => ({ rectangle, label: outside(point) ? 'Move onto Workbench' : 'Drag outside Display to detach' })}
        onDrop={(_preview, rectangle, point) => { if (outside(point)) detach(rectangle); }} onKeyboardMove={detachBeside} onError={setError} />
      <button type="button" className="system-workflow__round-control" aria-label="Finish editing Text" onClick={close}><Eye /></button>
    </div>
    {canvasRef.current && createPortal(<div className="text-workbench" style={{ '--text-z': 70 }} onPointerDown={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
      <TextTools article={article} onChange={save} controlsRef={setHost} disabled={placement.locked} onClose={close}
        initialX={canvasRef.current.getBoundingClientRect().right + 12} initialY={canvasRef.current.getBoundingClientRect().top}>
        <button type="button" disabled={placement.locked} onClick={detachBeside}>Move onto Workbench</button>
        {error ? <div role="alert">{error}<button type="button" onClick={() => save(working.current, { retry: true })}>Retry local save</button>
          {reason === 'conflict' && <button type="button" onClick={() => save(working.current, { retry: true, replace: true })}>Replace saved Text with my edits</button>}
        </div> : <p role="status">Saved in this browser</p>}
      </TextTools>
    </div>, canvasRef.current.closest('main') || document.body)}
  </div>;
}
