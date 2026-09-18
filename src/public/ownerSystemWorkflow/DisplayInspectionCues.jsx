import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { hitsArtwork } from './artworkPicking.js';
import { clamp, cuePosition } from './displayCueGeometry.js';
import DisplayInspectionCueButton from './DisplayInspectionCueButton.jsx';
import { Plus } from '../InscapeIcons.jsx';
import './displayInspectionCues.css';

// These controls select information in the shared Metadata window. They never
// open a second card or change the artwork's inspection/geometry.
export default function DisplayInspectionCues({ host, items, viewer, editable = false, disabled = false, onSelect, contentVersion }) {
  const [offsets, setOffsets] = useState({});
  const [layout, setLayout] = useState({ width: 0, height: 0, rows: [] });
  const latest = useRef(null); latest.current = { items, viewer, offsets };

  useLayoutEffect(() => {
    if (disabled || !host) return;
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
  }, [host, items, offsets, viewer.placementId, disabled, contentVersion]);

  if (disabled || viewer.placementId || !layout.width) return null;
  const stop = event => event.stopPropagation();
  return createPortal(<div className="display-inspection-cues" onPointerDown={stop} onClick={stop} onDoubleClick={stop} onContextMenu={stop}>
    {layout.rows.map(row => <DisplayInspectionCueButton key={row.id}
      host={host} bounds={layout} position={row} offset={row.offset} rectangle={row.rect} editable={editable}
      label={`Read metadata for ${row.label}`} onActivate={() => onSelect?.(row.id)}
      onMove={value => setOffsets(current => ({ ...current, [row.id]: { x: clamp(value.x, -.1, 1.1), y: clamp(value.y, -.1, 1.1) } }))}
      onReset={() => setOffsets(current => { const next = { ...current }; delete next[row.id]; return next; })}><Plus /></DisplayInspectionCueButton>)}
  </div>, host);
}
