import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import { WORKBENCH_GROUP_STACK_SIZE } from '../../systemWorkflow/domain/workbenchGroups.js';
import { editWorkbenchGroups } from '../../systemWorkflow/workbenchGroupSession.js';
import { clampWorkbenchPosition } from './workbenchSpace.js';

// A compact tile edits only its group's anchor. Member windows and navigation
// are supplied actions, never geometry owned by this pointer gesture.
export default function WorkbenchGroupStack({ group, previews, view, scene, locked, dropTarget, onManage, onError }) {
  const { scale, offset } = useWorkbenchCamera();
  const drag = useRef(null), node = useRef(null), [preview, setPreview] = useState(null);
  const latest = useRef(null); latest.current = { group, view, locked };
  const finish = useCallback(cancel => {
    const current = drag.current; if (!current) return;
    drag.current = null; setPreview(null);
    if (node.current?.hasPointerCapture(current.id)) node.current.releasePointerCapture(current.id);
    if (!cancel && current.next) try {
      editWorkbenchGroups(latest.current.view.store, latest.current.view.profileAddress,
        { type: 'position', id: current.group.id, expected: current.group, position: current.next }); onError('');
    } catch (failure) { onError(failure.message); }
  }, [onError]);
  useEffect(() => {
    const cancel = event => { if (event.type === 'blur' || event.key === 'Escape' || document.hidden) { if (drag.current) event.preventDefault(); finish(true); } };
    addEventListener('blur', cancel); addEventListener('keydown', cancel, true); document.addEventListener('visibilitychange', cancel);
    return () => { removeEventListener('blur', cancel); removeEventListener('keydown', cancel, true); document.removeEventListener('visibilitychange', cancel); finish(true); };
  }, [finish]);
  useEffect(() => { finish(true); }, [group, scale, offset.x, offset.y, locked, finish]);
  const position = preview || group.position;
  const move = position => { try { editWorkbenchGroups(view.store, view.profileAddress, { type: 'position', id: group.id, expected: group,
    position: clampWorkbenchPosition(position, WORKBENCH_GROUP_STACK_SIZE) }); onError(''); } catch (failure) { onError(failure.message); } };
  return <section className="workbench-group-stack" data-workbench-group-tools data-workbench-stack={group.id} data-workbench-group-drop={group.id}
    data-workbench-camera-decoration data-muted={Boolean(scene.active) || undefined} data-drop-target={dropTarget === group.id || undefined} aria-label={group.name + ' group stack'}
    style={{ left: 0, top: 0, width: WORKBENCH_GROUP_STACK_SIZE.width * scale, height: WORKBENCH_GROUP_STACK_SIZE.height * scale,
      transform: 'translate(' + (position.left * scale + offset.x) + 'px,' + (position.top * scale + offset.y) + 'px)' }}>
    <button ref={node} type="button" className="workbench-group-stack__grip" disabled={locked} aria-label={'Move ' + group.name + ' group'}
      onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true });
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, group }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { const start = drag.current; if (start?.id !== event.pointerId) return;
        start.next = clampWorkbenchPosition({ left: start.group.position.left + (event.clientX - start.x) / scale, top: start.group.position.top + (event.clientY - start.y) / scale }, WORKBENCH_GROUP_STACK_SIZE); setPreview(start.next); }}
      onPointerUp={() => finish(false)} onPointerCancel={() => finish(true)} onLostPointerCapture={() => finish(true)}
      onKeyDown={event => { const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]; if (!delta) return;
        event.preventDefault(); event.stopPropagation(); const step = event.shiftKey ? 10 : 1;
        move({ left: group.position.left + delta[0] * step, top: group.position.top + delta[1] * step }); }}><strong>{group.name}</strong><span>{group.memberIds.length}</span></button>
    <button type="button" className="workbench-group-stack__open" disabled={locked} aria-label={'Open ' + group.name + ' group'}
      onClick={() => { if (!scene.open(group)) onManage(group); }}>
      <span className="workbench-group-stack__previews">{previews.map((src, index) => <img key={index} src={src} alt="" draggable={false} />)}</span>
      <span>{group.memberIds.length ? 'Open group' : 'Drop modules here'}</span>
    </button>
    <button className="workbench-group-stack__manage" type="button" disabled={locked} aria-label={'Manage ' + group.name + ' group'} onClick={() => onManage(group)}>…</button>
  </section>;
}
