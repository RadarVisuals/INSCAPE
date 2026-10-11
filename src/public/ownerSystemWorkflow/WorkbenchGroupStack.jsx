import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkbenchCamera } from './WorkbenchCamera.jsx';
import { WORKBENCH_GROUP_STACK_SIZE } from '../../systemWorkflow/domain/workbenchGroups.js';
import { clampWorkbenchPosition } from './workbenchSpace.js';

// Browsing is shared. Only an owner-supplied position action installs authoring
// gestures; this component has no draft store or persistence authority.
export default function WorkbenchGroupStack({ group, previews, scene, locked, dropTarget, onManage, onPosition }) {
  const { scale, offset } = useWorkbenchCamera();
  const drag = useRef(null), node = useRef(null), [preview, setPreview] = useState(null);
  const positionAction = useRef(onPosition); positionAction.current = onPosition;
  const finish = useCallback(cancel => {
    const current = drag.current;
    if (!current) return;
    drag.current = null; setPreview(null);
    if (node.current?.hasPointerCapture(current.id)) node.current.releasePointerCapture(current.id);
    if (!cancel && current.next) positionAction.current?.(current.group, current.next);
  }, []);
  useEffect(() => {
    if (!onPosition) return;
    const cancel = event => {
      if (event.type === 'blur' || event.key === 'Escape' || document.hidden) {
        if (drag.current) event.preventDefault();
        finish(true);
      }
    };
    addEventListener('blur', cancel); addEventListener('keydown', cancel, true); document.addEventListener('visibilitychange', cancel);
    return () => {
      removeEventListener('blur', cancel); removeEventListener('keydown', cancel, true); document.removeEventListener('visibilitychange', cancel); finish(true);
    };
  }, [Boolean(onPosition), finish]);
  useEffect(() => { finish(true); }, [group, scale, offset.x, offset.y, locked, finish]);
  const position = preview || group.position, heading = <><strong>{group.name}</strong><span>{group.memberIds.length}</span></>;
  const move = next => onPosition?.(group, clampWorkbenchPosition(next, WORKBENCH_GROUP_STACK_SIZE));
  const available = Boolean(scene.bounds(group));
  return <section className="workbench-group-stack" data-workbench-group-tools data-workbench-stack={group.id} data-workbench-group-drop={onPosition ? group.id : undefined}
    data-workbench-camera-decoration data-muted={Boolean(scene.active) || undefined} data-drop-target={dropTarget === group.id || undefined} aria-label={group.name + ' group stack'}
    style={{ left: 0, top: 0, width: WORKBENCH_GROUP_STACK_SIZE.width * scale, height: WORKBENCH_GROUP_STACK_SIZE.height * scale,
      transform: 'translate(' + (position.left * scale + offset.x) + 'px,' + (position.top * scale + offset.y) + 'px)' }}>
    {onPosition ? <button ref={node} type="button" className="workbench-group-stack__grip" disabled={locked} aria-label={'Move ' + group.name + ' group'}
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault(); event.stopPropagation(); event.currentTarget.focus({ preventScroll: true });
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, group }; event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const start = drag.current;
        if (start?.id !== event.pointerId) return;
        start.next = clampWorkbenchPosition({ left: start.group.position.left + (event.clientX - start.x) / scale,
          top: start.group.position.top + (event.clientY - start.y) / scale }, WORKBENCH_GROUP_STACK_SIZE);
        setPreview(start.next);
      }}
      onPointerUp={() => finish(false)} onPointerCancel={() => finish(true)} onLostPointerCapture={() => finish(true)}
      onKeyDown={event => {
        const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
        if (!delta) return;
        event.preventDefault(); event.stopPropagation(); const step = event.shiftKey ? 10 : 1;
        move({ left: group.position.left + delta[0] * step, top: group.position.top + delta[1] * step });
      }}>{heading}</button> : <div className="workbench-group-stack__grip" data-read-only>{heading}</div>}
    <button type="button" className="workbench-group-stack__open" disabled={locked || !onManage && !available}
      title={!available && !onManage ? 'This group has no open windows' : undefined} aria-label={'Open ' + group.name + ' group'}
      onClick={() => { if (!scene.open(group)) onManage?.(group); }}>
      <span className="workbench-group-stack__previews">{previews.map((src, index) => <img key={index} src={src} alt="" draggable={false} decoding="async" loading="lazy" />)}</span>
      <span>{group.memberIds.length ? 'Open group' : 'Drop modules here'}</span>
    </button>
    {onManage && <button className="workbench-group-stack__manage" type="button" disabled={locked} aria-label={'Manage ' + group.name + ' group'} onClick={() => onManage(group)}>…</button>}
  </section>;
}
