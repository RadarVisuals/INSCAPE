import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Temporary, user-triggered diagnostics. No draft access, image URLs, canvas
// capture, animation changes or placement writes. Remove after seam diagnosis.
const bounds = node => {
  const r = node.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
};
const inspect = node => {
  if (!node) return null;
  const style = getComputedStyle(node);
  return { rect: bounds(node), css: Object.fromEntries([
    'width', 'height', 'left', 'top', 'zoom', 'transform', 'translate', 'transformOrigin',
    'overflowX', 'overflowY', 'clipPath', 'mixBlendMode', 'isolation', 'opacity',
    'visibility', 'filter', 'willChange', 'objectFit', 'objectViewBox',
  ].map(key => [key, style[key]])) };
};
const placements = plane => [...plane.querySelectorAll('.system-workflow__placement, .lattice-production-placement')]
  .map((node, index) => ({ node, index, rect: bounds(node) }));
const edgeArtwork = (plane, edge, y, side, density) => placements(plane)
  .filter(item => item.rect.top <= y && item.rect.bottom >= y)
  .sort((a, b) => Math.abs(a.rect[side] - edge) - Math.abs(b.rect[side] - edge))
  .slice(0, 3).map(({ node, index, rect }) => ({
    placement: node.dataset.systemWorkflowPlacementId || node.dataset.placementId || `rendered-${index}`,
    edgeDifferencePhysicalPx: (rect[side] - edge) * density,
    placementBox: inspect(node),
    opening: inspect(node.querySelector('.system-workflow__artwork-opening, .lattice-production-placement__opening')),
    surface: inspect(node.querySelector('.display-artwork-surface')),
    image: inspect(node.querySelector('img')),
    imageReady: node.querySelector('img')?.complete ?? null,
  }));

function measure(host, scale, offset) {
  const density = globalThis.devicePixelRatio || 1;
  const tracks = [...(host?.querySelectorAll('.system-workflow__grid-track, .visitor-grid-world__grid-track') || [])];
  return { diagnostic: 'grid-seam-v1', capturedAt: new Date().toISOString(),
    workbenchScale: scale, workbenchPan: offset, devicePixelRatio: density,
    viewport: { width: innerWidth, height: innerHeight, visualScale: visualViewport?.scale ?? 1 },
    note: 'DOM geometry only. Zero geometric gap does not prove opaque pixel coverage; source transparency, clipping and compositing still require visual confirmation.',
    displays: tracks.map(track => {
      const board = track.closest('[data-workbench-view-id]');
      const viewport = track.parentElement, clip = bounds(viewport);
      const planes = [...track.children].filter(node => node.dataset.renderedGridId)
        .map(node => ({ node, rect: bounds(node), style: getComputedStyle(node) }))
        .filter(item => item.style.visibility !== 'hidden' && item.style.display !== 'none')
        .sort((a, b) => a.rect.left - b.rect.left);
      const joins = planes.slice(1).flatMap((right, index) => {
        const left = planes[index];
        const edge = (left.rect.right + right.rect.left) / 2;
        if (edge <= Math.max(clip.left, 0) || edge >= Math.min(clip.right, innerWidth)) return [];
        const top = Math.max(clip.top, left.rect.top, right.rect.top, 0);
        const bottom = Math.min(clip.bottom, left.rect.bottom, right.rect.bottom, innerHeight);
        if (bottom <= top) return [];
        const gap = right.rect.left - left.rect.right;
        return [{ leftGrid: left.node.dataset.renderedGridId, rightGrid: right.node.dataset.renderedGridId,
          leftSlot: left.node.dataset.railSlot, rightSlot: right.node.dataset.railSlot,
          gapCssPx: gap, gapPhysicalPx: gap * density,
          leftEdgePhysicalPx: left.rect.right * density, rightEdgePhysicalPx: right.rect.left * density,
          leftPlane: inspect(left.node), rightPlane: inspect(right.node),
          samples: [.1, .5, .9].map(fraction => {
            const y = top + (bottom - top) * fraction;
            return { yCssPx: y, leftArtwork: edgeArtwork(left.node, left.rect.right, y, 'right', density),
              rightArtwork: edgeArtwork(right.node, right.rect.left, y, 'left', density) };
          }) }];
      });
      return { displayId: board?.dataset.workbenchViewId, board: inspect(board), viewport: inspect(viewport),
        track: inspect(track), animations: track.getAnimations().map(animation => ({
          state: animation.playState, time: animation.currentTime, playbackRate: animation.playbackRate,
        })), visibleGridCount: planes.length, joins };
    }) };
}

export default function GridSeamProbe({ hostRef, scale, offset }) {
  const [report, setReport] = useState(null), [status, setStatus] = useState('');
  const dialog = useRef(null), trigger = useRef(null), field = useRef(null);
  useLayoutEffect(() => { if (report) dialog.current?.showModal(); }, [report]);
  const text = report ? JSON.stringify(report, null, 2) : '';
  const joins = report?.displays.flatMap(display => display.joins) || [];
  const close = () => { setReport(null); trigger.current?.focus({ preventScroll: true }); };
  return <>
    <button ref={trigger} type="button" onClick={() => { setStatus(''); setReport(measure(hostRef.current, scale, offset)); }}>Meet Grid-naad</button>
    {report && createPortal(<dialog ref={dialog} onClose={close} aria-label="Grid-naad meting"
      style={{ width: 'min(640px, 90vw)', maxHeight: '85vh', overflow: 'auto', padding: 16,
        background: 'var(--workflow-panel, #171717)', color: 'var(--workflow-ink, #eee)',
        border: '1px solid var(--workflow-border, #777)', fontFamily: 'Inscape Sora, sans-serif' }}>
      <p>{joins.length ? `${joins.length} zichtbare Grid-overgang(en) gemeten. Positief verschil = ruimte; negatief = overlap.`
        : 'Geen interne Grid-overgang zichtbaar. Sluit dit venster, zet twee Grids gedeeltelijk in beeld en meet opnieuw.'}</p>
      {joins.map((join, index) => <p key={index}>Overgang {index + 1}: {join.gapPhysicalPx.toFixed(6)} fysieke pixels verschil.</p>)}
      <textarea ref={field} readOnly value={text} aria-label="Meetrapport" spellCheck={false}
        style={{ width: '100%', height: '32vh', boxSizing: 'border-box', background: 'transparent', color: 'inherit', fontFamily: 'Inscape IBM Plex Sans Condensed, monospace' }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        <button type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(text); setStatus('Gekopieerd. Plak het rapport in de chat.'); }
          catch { field.current?.focus(); field.current?.select(); setStatus('Kopieer de geselecteerde tekst met Ctrl+C.'); }
        }}>Kopieer rapport</button>
        <button type="button" onClick={() => {
          const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
          const link = document.createElement('a'); link.href = url; link.download = 'inscape-grid-naad.json'; link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}>Download rapport</button>
        <button type="button" onClick={() => dialog.current?.close()}>Sluiten</button>
      </div>
      <p role="status">{status}</p>
    </dialog>, document.body)}
  </>;
}
