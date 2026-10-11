import { lazy, Suspense, useLayoutEffect, useRef, useState } from 'react';
import { Eye } from '../public/InscapeIcons.jsx';
import DisplayTextContent from '../public/ownerSystemWorkflow/DisplayTextContent.jsx';
import { displayTextArticle } from '../systemWorkflow/domain/displayText.js';
import { detachTextFromDisplay, saveDisplayArticleResult } from './textTransfer.js';
import TextTools from './TextTools.jsx';
import { useSharedTextTools } from './SharedTextTools.jsx';
import { textRecoveryScope } from './textEditRecovery.js';
import useTextEditSession from './useTextEditSession.js';
import TextMoveHandle from './TextMoveHandle.jsx';
import { useWorkbenchView } from '../public/ownerSystemWorkflow/WorkbenchViewContext.js';
import { useWorkbenchCamera } from '../public/ownerSystemWorkflow/WorkbenchCamera.jsx';
import { clampWorkbenchPosition, unprojectWorkbenchPosition } from '../public/ownerSystemWorkflow/workbenchSpace.js';
const ArticleEditor = lazy(() => import('./ArticleEditor.jsx'));
const articleValue = placement => displayTextArticle(placement.text);
const saveArticle = (store, scope, expected, article, options) => saveDisplayArticleResult(store, scope.profile,
  { moduleId: scope.moduleId, gridId: scope.gridId, expected, article }, options);

export default function DisplayArticleEditor({ placement, controller, cellSize, width, height, screenCellSize, canvasRef, onClose, suspended = false }) {
  const tools = useSharedTextTools();
  const { scale: standaloneScale } = useWorkbenchView();
  const { offset } = useWorkbenchCamera();
  const scope = textRecoveryScope(controller.draft.profileAddress, placement.id, controller.moduleId, controller.selectedGridId);
  const { value: article, failed, error, reason, session: edit } = useTextEditSession({ store: controller.store, scope, record: placement, valueOf: articleValue, saveRecord: saveArticle });
  const { save, setError } = edit;
  const [host, setHost] = useState(null);
  const root = useRef(null), [actions, setActions] = useState({ top: 56, right: 8 });
  useLayoutEffect(() => {
    const bounds = root.current.getBoundingClientRect(), canvas = canvasRef.current.getBoundingClientRect();
    const board = canvasRef.current.closest('.system-workflow__presentation-board')?.getBoundingClientRect() || canvas;
    const scale = screenCellSize / cellSize;
    setActions({ top: Math.max(8, (Math.max(board.top + 56, canvas.top + 8) - bounds.top) / scale), right: Math.max(8, (bounds.right - canvas.right + 8) / scale) });
  }, [placement.column, placement.row, placement.columnSpan, placement.rowSpan, screenCellSize, cellSize]);
  const detach = rectangle => {
    if (!save(edit.getSnapshot().value)) return;
    const size = { width: Math.max(240, rectangle.width / standaloneScale), height: Math.max(180, rectangle.height / standaloneScale) };
    const position = clampWorkbenchPosition(unprojectWorkbenchPosition(rectangle, standaloneScale, offset), size);
    const id = detachTextFromDisplay(controller.store, controller.draft.profileAddress, { moduleId: controller.moduleId, gridId: controller.selectedGridId,
      expected: edit.getSnapshot().record, cellSize: screenCellSize / standaloneScale, window: { ...position, ...size } });
    tools?.activate(id); tools?.setOpen(true);
  };
  const outside = point => { const bounds = canvasRef.current?.getBoundingClientRect(); return bounds && (point.x < bounds.left || point.x > bounds.right || point.y < bounds.top || point.y > bounds.bottom); };
  const detachBeside = () => {
    const bounds = canvasRef.current?.getBoundingClientRect(); if (!bounds) return;
    try { detach({ left: bounds.right + 12, top: bounds.top, width: placement.columnSpan * screenCellSize, height: placement.rowSpan * screenCellSize }); }
    catch (failure) { setError(failure.message); }
  };
  const close = () => {
    if (failed) return false;
    const trigger = root.current?.closest('[data-system-workflow-placement-id]');
    onClose(); queueMicrotask(() => trigger?.isConnected && trigger.focus({ preventScroll: true }));
  };
  return <div ref={root} className="text-workbench display-text-authoring">
    <DisplayTextContent placement={{ ...placement, text: { article } }} cellSize={cellSize} width={width} height={height}>
      <Suspense fallback={<p role="status">Opening editor…</p>}><ArticleEditor article={article} onChange={save} controlsHost={host} disabled={placement.locked || suspended} saveError={error}
        onFindRequest={() => { if (!placement.locked && !suspended) { tools?.activate(controller.moduleId); tools?.setOpen(true); } }} /></Suspense>
    </DisplayTextContent>
    <div className="display-text-edit-actions" style={actions}>
      <TextMoveHandle label="Drag Text out of Display" disabled={placement.locked} previewAt={(point, rectangle) => ({ rectangle, label: outside(point) ? 'Move onto Workbench' : 'Drag outside Display to detach' })}
        onDrop={(_preview, rectangle, point) => { if (outside(point)) detach(rectangle); }} onKeyboardMove={detachBeside} onError={setError} />
      <button type="button" className="system-workflow__round-control" aria-label="Finish editing Text" onClick={close}><Eye /></button>
    </div>
    {canvasRef.current && <TextTools targetId={controller.moduleId} available={!suspended} article={article} onChange={save} controlsRef={setHost} disabled={placement.locked} onClose={close}
        backupScope={JSON.stringify(scope)} recoveryPending={failed}
        anchor={canvasRef.current.getBoundingClientRect()} footer={error ? <div role="alert">{error}<button type="button" onClick={() => save(edit.getSnapshot().value, { retry: true })}>Retry local save</button>
          {reason === 'conflict' && <button type="button" onClick={() => save(edit.getSnapshot().value, { retry: true, replace: true })}>Replace saved Text with my edits</button>}
        </div> : <p role="status">Saved in this browser</p>}>
        <button type="button" disabled={placement.locked} onClick={detachBeside}>Move onto Workbench</button>

      </TextTools>}
  </div>;
}
