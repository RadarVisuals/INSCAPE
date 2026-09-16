import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DisplayMetadataCard from './DisplayMetadataCard.jsx';
import { hitsArtwork } from './artworkPicking.js';
import { clamp, cuePosition, cueBubbleRectangle } from './displayCueGeometry.js';
import { displayLiftRectangle } from './displayLiftGeometry.js';
import { resolveInspectionMode } from '../../systemWorkflow/domain/systemWorkflowDraft.js';
import DisplayInspectionCueButton from './DisplayInspectionCueButton.jsx';
import { Minus, Plus } from '../InscapeIcons.jsx';
import './displayInspectionCues.css';

// A temporary Display experiment. Offsets are relative to each placement and
// live only in this mounted Grid; they never enter a draft or publication.
export default function DisplayInspectionCues({ host, items, viewer, editable = false, disabled = false, getDossier }) {
  const [offsets, setOffsets] = useState({});
  const [liftOffsets, setLiftOffsets] = useState({});
  const [preferences, setPreferences] = useState({});
  const [layout, setLayout] = useState({ width: 0, height: 0, rows: [] });
  const latest = useRef(null); latest.current = { items, viewer, offsets };
  const cueRefs = useRef(new Map());
  const activeCueRef = useRef(null);
  // Auto chooses once per open foldout, so anchor movement cannot flip its side.
  // Explicit direction overrides it; closing/switching inspection invalidates it.
  const openingSide = useRef(null);
  const priorCue = useRef(null);
  const [error, setError] = useState(null);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useLayoutEffect(() => {
    let frame;
    const measure = () => {
      const bounds = host.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const width = host.clientWidth, height = host.clientHeight;
      const { items: placements, viewer: current, offsets: positions } = latest.current;
      const rows = placements.flatMap(item => {
        const node = current.getElement(item.id);
        const entry = current.getEntry(item.id);
        if (!node || !entry) return [];
        const style = getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return [];
        const box = node.getBoundingClientRect();
        if (!box.width || !box.height || box.right <= bounds.left || box.left >= bounds.right
          || box.bottom <= bounds.top || box.top >= bounds.bottom) return [];
        const rect = { x: (box.left - bounds.left) * width / bounds.width,
          y: (box.top - bounds.top) * height / bounds.height,
          width: box.width * width / bounds.width, height: box.height * height / bounds.height };
        let automatic = { x: .8, y: .2 };
        // Reuse the picker's cached mask and transform/crop handling. Bound the
        // search; unreadable masks retain the existing rectangular fallback.
        if (!positions[item.id] && !current.placementId) {
          const candidates = [];
          for (const y of [.15, .3, .5, .7, .85]) for (const x of [.85, .7, .5, .3, .15]) candidates.push({ x, y });
          candidates.sort((a, b) => Math.hypot(a.x - .85, a.y - .2) - Math.hypot(b.x - .85, b.y - .2));
          automatic = candidates.find(point => hitsArtwork(node, box.left + box.width * point.x, box.top + box.height * point.y)) || automatic;
        }
        const offset = positions[item.id] || automatic;
        return [{ id: item.id, label: entry.accessibleLabel || entry.dossier?.title || 'Artwork', rect, offset,
          ...cuePosition(rect, offset, { width, height }) }];
      });
      setLayout({ width, height, rows });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const resize = new ResizeObserver(schedule); resize.observe(host);
    const mutations = new MutationObserver(schedule);
    const scene = host.querySelector('.system-workflow__inspection-scene');
    if (scene) mutations.observe(scene, { subtree: true, childList: true, attributes: true,
      attributeFilter: ['style', 'class', 'hidden', 'data-media-state'] });
    host.addEventListener('pointerenter', schedule);
    host.addEventListener('load', schedule, true);
    window.addEventListener('resize', schedule);
    measure();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); mutations.disconnect();
      host.removeEventListener('pointerenter', schedule); host.removeEventListener('load', schedule, true);
      window.removeEventListener('resize', schedule); };
  }, [host, items, offsets, viewer.placementId]);

  useEffect(() => {
    if (priorCue.current && !viewer.placementId) cueRefs.current.get(priorCue.current)?.focus({ preventScroll: true });
    priorCue.current = viewer.cue ? viewer.placementId : null;
  }, [viewer.placementId, viewer.cue]);
  useEffect(() => {
    if (viewer.cue && !viewer.cueMetadataOpen) activeCueRef.current?.focus({ preventScroll: true });
  }, [viewer.cueMetadataOpen, viewer.cue]);

  const stop = event => event.stopPropagation();
  const updateOffset = (id, value) => setOffsets(current => ({ ...current,
    [id]: { x: clamp(value.x, -.1, 1.1), y: clamp(value.y, -.1, 1.1) } }));
  const resetOffset = id => setOffsets(current => { const next = { ...current }; delete next[id]; return next; });
  const updateLiftOffset = (id, value) => setLiftOffsets(current => ({ ...current,
    [id]: { x: clamp(value.x, -.1, 1.1), y: clamp(value.y, -.1, 1.1) } }));
  const resetLiftOffset = id => setLiftOffsets(current => { const next = { ...current }; delete next[id]; return next; });
  const open = async row => {
    setError(null);
    const opened = await viewer.open(row.id, viewer.getElement(row.id), {
      cue: { x: row.x / layout.width, y: row.y / layout.height,
        restoreFocus: () => cueRefs.current.get(row.id)?.focus({ preventScroll: true }) } });
    if (!opened && mounted.current) setError('Artwork could not be opened. Try again.');
  };
  if (disabled || !layout.width || !layout.height) return null;
  const active = viewer.cue && viewer.placementId;
  const lifted = active && resolveInspectionMode(viewer.entry?.placement) === 'LIFT';
  const fitted = lifted && displayLiftRectangle(viewer.entry, layout);
  const liftRectangle = fitted && { x: fitted.left, y: fitted.top, width: fitted.width, height: fitted.height };
  const liftOffset = liftOffsets[active] || { x: .98, y: .12 };
  const sceneRectangle = layout.rows.find(row => row.id === active)?.rect
    || { x: 0, y: 0, width: layout.width, height: layout.height };
  const sceneOffset = active && (offsets[active] || {
    x: (viewer.cue.x * layout.width - sceneRectangle.x) / sceneRectangle.width,
    y: (viewer.cue.y * layout.height - sceneRectangle.y) / sceneRectangle.height,
  });
  const movement = { host, bounds: layout, rectangle: lifted ? liftRectangle : sceneRectangle,
    offset: lifted ? liftOffset : sceneOffset, editable,
    onMove: value => lifted ? updateLiftOffset(active, value) : updateOffset(active, value),
    onReset: () => lifted ? resetLiftOffset(active) : resetOffset(active) };
  const anchor = active && cuePosition(movement.rectangle, movement.offset, layout);
  const preferenceKey = `${active}:${lifted ? 'lift' : 'in-place'}`;
  if (!active || !viewer.cueMetadataOpen) openingSide.current = null;
  else if (openingSide.current?.key !== preferenceKey) openingSide.current = {
    key: preferenceKey, value: layout.width - anchor.x > anchor.x ? 'right' : 'left',
  };
  const preference = preferences[preferenceKey] || 'auto';
  const direction = preference === 'auto' ? openingSide.current?.value || 'auto' : preference;
  const bubble = anchor && cueBubbleRectangle(anchor, layout, direction);
  const dossier = active ? getDossier?.(active) || viewer.entry?.dossier : null;
  const activeControl = active && <DisplayInspectionCueButton ref={activeCueRef} {...movement} position={anchor}
    embedded={viewer.cueMetadataOpen}
    label={viewer.cueMetadataOpen ? 'Hide artwork metadata' : 'Show artwork metadata'} expanded={viewer.cueMetadataOpen}
    onActivate={() => viewer.setCueMetadataOpen(!viewer.cueMetadataOpen)}>
    {viewer.cueMetadataOpen ? <Minus /> : <Plus />}</DisplayInspectionCueButton>;
  return createPortal(<div className="display-inspection-cues" data-open={Boolean(active) || undefined}
    onPointerDown={stop} onClick={stop} onDoubleClick={stop} onContextMenu={stop}>
    {!viewer.placementId && layout.rows.map(row => <DisplayInspectionCueButton key={row.id}
      ref={node => { if (node) cueRefs.current.set(row.id, node); else cueRefs.current.delete(row.id); }}
      host={host} bounds={layout} position={row} offset={row.offset} rectangle={row.rect} editable={editable}
      label={`Inspect ${row.label}`} onActivate={() => open(row)}
      onMove={value => updateOffset(row.id, value)} onReset={() => resetOffset(row.id)}><Plus /></DisplayInspectionCueButton>)}
    {active && <>
      {!viewer.cueMetadataOpen && activeControl}
      {viewer.cueMetadataOpen && <section className="display-inspection-bubble" aria-label="Artwork metadata bubble" style={bubble.style}
        onWheel={stop} onPointerDown={stop} onKeyDown={event => {
          if (event.key !== 'Escape') event.stopPropagation();
        }}>
        <DisplayMetadataCard key={active} dossier={dossier} collapseControl={activeControl}
          collapseSide={bubble.collapseSide} upward={bubble.upward} movement={movement}
          settings={editable && <>
          <label>Open <select aria-label="Metadata opening direction" value={preferences[preferenceKey] || 'auto'}
            onChange={event => setPreferences(current => ({ ...current, [preferenceKey]: event.target.value }))}>
            <option value="auto">Automatically</option><option value="left">To the left</option><option value="right">To the right</option>
          </select></label>
          <button type="button" onClick={() => {
            if (lifted) resetLiftOffset(active); else resetOffset(active);
            setPreferences(current => { const next = { ...current }; delete next[preferenceKey]; return next; });
            viewer.setCueMetadataOpen(false);
          }}>{lifted ? 'Reset enlarged cue position' : 'Reset cue position'}</button>
        </>} />
      </section>}
    </>}
    {error && <p className="display-inspection-error" role="status">{error}</p>}
  </div>, host);
}
