import { useLayoutEffect, useRef, useState } from 'react';

// All direct children are grid cells, including expanded image choices and files.
export default function SourceCardGrid({ cells, renderCell, ...props }) {
  const grid = useRef(null);
  const count = cells.length;
  const [window, setWindow] = useState({ start: 0, end: 48, top: 0, bottom: 0 });
  useLayoutEffect(() => {
    const node = grid.current,
      root = node.closest('.lattice-browser-results');
    function measure() {
      const cell = node.firstElementChild;
      if (!cell || !root) return;
      const style = getComputedStyle(node);
      const columns = Math.max(1, style.gridTemplateColumns.split(' ').length);
      const gap = parseFloat(style.rowGap) || 0;
      const pitch = (parseFloat(style.gridAutoRows) || cell.getBoundingClientRect().height) + gap;
      if (pitch <= gap) return;
      const offset = root.getBoundingClientRect().top - node.getBoundingClientRect().top;
      const rows = Math.ceil(count / columns);
      const first = Math.min(rows - 1, Math.max(0, Math.floor(offset / pitch) - 2));
      const last = Math.min(rows, Math.max(first + 1, Math.ceil((offset + root.clientHeight) / pitch) + 2));
      const next = {
        start: first * columns,
        end: last * columns,
        top: first * pitch,
        bottom: (rows - last) * pitch,
      };
      setWindow(old => (Object.keys(next).every(k => old[k] === next[k]) ? old : next));
    }
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(root);
    resize.observe(node);
    root.addEventListener('scroll', measure, { passive: true });
    return () => {
      resize.disconnect();
      root.removeEventListener('scroll', measure);
    };
  }, [count, props['data-labels'], props.style['--library-tile-size']]);
  const valid = window.start < count;
  return (
    <div
      {...props}
      data-windowed
      ref={grid}
      style={{
        ...props.style,
        overflowAnchor: 'none',
        paddingTop: valid ? window.top : 0,
        paddingBottom: valid ? window.bottom : 0,
      }}
    >
      {cells.slice(valid ? window.start : 0, valid ? window.end : 48).map(renderCell)}
    </div>
  );
}
