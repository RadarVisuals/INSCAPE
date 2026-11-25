import { useEffect, useRef } from 'react';

const sides = ['top', 'right', 'bottom', 'left'];
const bound = (value, max) => Math.max(0, Math.min(max, Math.round(value)));

export default function TextPaddingHandles({ article, frame, preview, onPreview, onCommit }) {
  const surface = useRef(null), drag = useRef(null);
  const appearance = article.appearance || {};
  const fallback = appearance.compact ? 0 : window.matchMedia('(max-width:600px)').matches ? 16 : 24;
  const padding = preview || Object.fromEntries(sides.map(side => [side, fallback]));
  const transform = appearance.transform || {};
  useEffect(() => () => { drag.current = null; onPreview(null); }, [article, onPreview]);

  function update(event, finish) {
    const start = drag.current;
    if (!start || start.pointer !== event.pointerId) return;
    const position = start.horizontal ? event.clientX : event.clientY;
    const value = bound(start.padding[start.side] + (position - start.position) * start.factor, start.max);
    const next = { ...start.padding, [start.side]: value };
    if (finish) {
      drag.current = null;
      onPreview(null);
      if (value !== start.padding[start.side]) onCommit(next);
    } else onPreview({ source: article, padding: next });
  }
  function cancel() {
    if (drag.current) { drag.current = null; onPreview(null); }
  }
  return <div ref={surface} className="text-padding-handles" data-workbench-selection-tools>
    {sides.map((side, index) => {
      const mirrored = index % 2 ? transform.mirrorX : transform.mirrorY;
      const edge = sides[(index + (mirrored ? 2 : 0) + (transform.quarterTurns || 0)) % 4];
      const horizontal = edge === 'left' || edge === 'right';
      const dimension = frame[horizontal ? 'width' : 'height'] / (appearance.scale || 1);
      const max = Math.min(512, Math.max(padding[side], Math.floor(dimension - padding[sides[(index + 2) % 4]] - 1)));
      const sign = edge === 'top' || edge === 'left' ? 1 : -1;
      const distance = 'clamp(12px, ' + (100 * padding[side] / dimension) + '%, calc(100% - 12px))';
      const anchor = { left: 'top', top: 'left', right: 'bottom', bottom: 'right' };
      const style = { [edge]: distance, [anchor[edge]]: 0 };
      return <button key={side} type="button" role="slider" aria-label={side + ' text padding'} title={side + ' text padding'}
        aria-valuenow={padding[side]} aria-valuemin={0} aria-valuemax={max} aria-orientation={horizontal ? 'horizontal' : 'vertical'}
        className={'text-padding-handle at-' + edge} style={style}
        onPointerDown={event => {
          if (event.button !== 0 || drag.current) return;
          event.stopPropagation(); event.currentTarget.focus({ preventScroll: true }); event.currentTarget.setPointerCapture(event.pointerId);
          const rect = surface.current.getBoundingClientRect();
          drag.current = { side, horizontal, padding, max, pointer: event.pointerId, position: horizontal ? event.clientX : event.clientY,
            factor: sign * dimension / rect[horizontal ? 'width' : 'height'] };
        }}
        onPointerMove={event => update(event, false)} onPointerUp={event => update(event, true)}
        onPointerCancel={cancel} onLostPointerCapture={cancel}
        onKeyDown={event => {
          if (event.key === 'Escape' && drag.current) { event.stopPropagation(); cancel(); return; }
          const arrows = horizontal ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
          if (!arrows.includes(event.key)) return;
          event.preventDefault(); event.stopPropagation();
          onCommit({ ...padding, [side]: bound(padding[side] + sign * (event.key === arrows[1] ? 1 : -1) * (event.shiftKey ? 10 : 1), max) });
        }} />;
    })}
  </div>;
}
