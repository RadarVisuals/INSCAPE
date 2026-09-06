import { useLayoutEffect, useRef, useState } from 'react';
import { ExternalLink, PanelRightOpen, UserRound, X } from 'lucide-react';
import { normalizeProfileAddress } from '../../library/config.js';
import { useProfileIdentity } from '../../profileIdentity/index.js';
import OwnerSystemWorkflowDetachedWindow from './OwnerSystemWorkflowDetachedWindow.jsx';
import {
  clampOwnerSystemWorkflowWindowHeight,
  clampOwnerSystemWorkflowWindowPosition,
  presentationBoardAdjacentWindowGeometry,
} from './ownerSystemWorkflowWindowGeometry.js';

const compact = (value) => value?.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;

function Creator({ creator }) {
  const address = normalizeProfileAddress(creator?.address);
  const identity = useProfileIdentity(address);
  const resolved = identity?.status === 'RESOLVED' && identity.isUniversalProfile;
  const name = resolved && identity.name || creator?.name || compact(address) || 'Unknown creator';
  const href = address ? resolved ? `https://universaleverything.io/${address}`
    : `https://explorer.lukso.network/address/${address}` : null;
  const body = <><i>{resolved && identity.avatarUrl ? <img alt="" src={identity.avatarUrl} /> : <UserRound />}</i>
    <span><strong>{name}</strong>{address && <small>{compact(address)}</small>}</span>{href && <ExternalLink />}</>;
  return href ? <a aria-label={`Open creator ${name}`} href={href} rel="noreferrer" target="_blank">{body}</a> : <div>{body}</div>;
}

function OwnerSystemWorkflowMetadataFields({ dossier }) {
  return <>
    <section><small>CREATOR</small><Creator creator={dossier?.creators?.[0]} /></section>
    <section className="system-workflow__metadata-module-description"><small>DESCRIPTION</small>
      <p>{dossier?.description || 'Select one artwork to inspect its metadata.'}</p></section>
    {dossier?.collection && <section className="system-workflow__metadata-module-collection"><small>COLLECTION</small>
      <strong>{dossier.collection}</strong></section>}
    {dossier?.traits?.length > 0 && <ul aria-label="Traits" className="system-workflow__metadata-module-traits">
      {dossier.traits.map((entry, index) => <li key={`${entry.label}-${index}`}><small>{entry.label}</small><strong>{entry.value}</strong></li>)}
    </ul>}
    {dossier?.assetDetailHref && <a className="system-workflow__metadata-asset-link" href={dossier.assetDetailHref}
      rel="noreferrer" target="_blank">ASSET ID ↗</a>}
  </>;
}

export function OwnerSystemWorkflowMetadataContent({ dossier }) {
  return <div className="system-workflow__metadata-module-content">
    <OwnerSystemWorkflowMetadataFields dossier={dossier} />
  </div>;
}

export default function OwnerSystemWorkflowMetadataModule({ dossier, onClose, onDock }) {
  const moduleTitle = dossier?.title || 'SELECTED ASSET';
  const initialGeometry = useRef(null);
  if (initialGeometry.current === null) {
    const workbench = globalThis.document?.querySelector?.('[data-presentation-workbench]')?.getBoundingClientRect?.();
    const boardNode = globalThis.document?.querySelector?.('.system-workflow__presentation-board');
    const board = boardNode?.getBoundingClientRect?.();
    const screenHeight = globalThis.innerHeight || 700;
    const screenWidth = globalThis.innerWidth || 1000;
    const viewport = {
      height: Math.min(workbench?.bottom || screenHeight, screenHeight),
      width: Math.min(workbench?.right || screenWidth, screenWidth),
    };
    const chromeGutter = boardNode
      ? Number.parseFloat(globalThis.getComputedStyle?.(boardNode)
        ?.getPropertyValue?.('--workflow-board-frame-gap')) || 6
      : 6;
    initialGeometry.current = board
      ? presentationBoardAdjacentWindowGeometry(board, viewport, { chromeGutter })
      : { height: null, position: { x: Math.max(18, screenWidth - 352), y: 72 } };
  }
  const [position, setPosition] = useState(initialGeometry.current.position);
  const [height, setHeight] = useState(initialGeometry.current.height);
  const drag = useRef(null);
  const moduleRef = useRef(null);
  const resize = useRef(null);
  const heightRef = useRef(height);
  heightRef.current = height;
  const viewport = () => {
    const workbench = globalThis.document?.querySelector?.('[data-presentation-workbench]')?.getBoundingClientRect?.();
    const screenHeight = globalThis.innerHeight || 700;
    const screenWidth = globalThis.innerWidth || 1000;
    return { height: Math.min(workbench?.bottom || screenHeight, screenHeight), width: Math.min(workbench?.right || screenWidth, screenWidth) };
  };
  const measuredSize = () => {
    const rectangle = moduleRef.current?.getBoundingClientRect?.();
    return rectangle ? { height: rectangle.height, width: rectangle.width } : { height: 68, width: 320 };
  };
  const clampPosition = (candidate, size = measuredSize()) => clampOwnerSystemWorkflowWindowPosition(
    candidate, size, viewport(), 8,
  );
  const clampHeight = (candidate, top = position.y, minimum = 68) =>
    clampOwnerSystemWorkflowWindowHeight(candidate, top, viewport().height, { minimum });
  useLayoutEffect(() => {
    const node = moduleRef.current;
    if (!node) return undefined;
    const reclamp = () => setPosition((current) => {
      if (heightRef.current !== null) {
        const nextHeight = clampHeight(heightRef.current, current.y);
        if (nextHeight !== heightRef.current) setHeight(nextHeight);
      }
      const next = clampPosition(current);
      return next.x === current.x && next.y === current.y ? current : next;
    });
    reclamp();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(reclamp) : null;
    observer?.observe(node);
    globalThis.addEventListener?.('resize', reclamp);
    return () => { observer?.disconnect(); globalThis.removeEventListener?.('resize', reclamp); };
  }, []);
  const beginDrag = (event) => {
    if (event.button !== 0 || event.target.closest('button')) return;
    drag.current = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, left: position.x, top: position.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event) => {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    setPosition(clampPosition({
      x: start.left + event.clientX - start.clientX,
      y: start.top + event.clientY - start.clientY,
    }));
  };
  const stopDrag = (event) => { if (drag.current?.id === event.pointerId) drag.current = null; };
  const beginResize = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const currentHeight = measuredSize().height;
    resize.current = { clientY: event.clientY, height: currentHeight, id: event.pointerId };
    setHeight(currentHeight);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveResize = (event) => {
    const start = resize.current;
    if (!start || start.id !== event.pointerId) return;
    setHeight(clampHeight(start.height + event.clientY - start.clientY, position.y, 180));
  };
  const stopResize = (event) => {
    const start = resize.current;
    if (start?.id !== event.pointerId) return;
    const next = clampHeight(start.height + event.clientY - start.clientY, position.y, 180);
    resize.current = null;
    setHeight(next);
  };
  return <OwnerSystemWorkflowDetachedWindow ariaLabel="Metadata module" className="system-workflow__metadata-module"
    controls={<>
      <button aria-label="Dock Metadata to Display Module" className="system-workflow__round-control"
        onClick={onDock} type="button"><PanelRightOpen /></button>
      <button aria-label="Close Metadata" className="system-workflow__round-control is-close"
        onClick={onClose} type="button"><X /></button>
    </>}
    headerPointerProps={{ onPointerDown: beginDrag, onPointerMove: moveDrag, onPointerUp: stopDrag, onPointerCancel: stopDrag }}
    ref={moduleRef}
    resizeHandleProps={{ 'aria-label': 'Resize Metadata height', onPointerCancel: stopResize,
      onPointerDown: beginResize, onPointerMove: moveResize, onPointerUp: stopResize }}
    style={{ '--detached-window-noise-x': `${-position.x - 1}px`,
      '--detached-window-noise-y': `${-position.y - 1}px`,
      height: height === null ? undefined : `${height}px`, left: position.x,
      maxHeight: `${clampHeight(Number.MAX_SAFE_INTEGER)}px`, top: position.y }}
    surfaceClassName="system-workflow__metadata-module-content" title={moduleTitle}>
    <OwnerSystemWorkflowMetadataFields dossier={dossier} />
  </OwnerSystemWorkflowDetachedWindow>;
}
