import { useEffect, useRef } from 'react';

// Project the three room planes through one vanishing point. Only the visible
// grid lines are drawn, regardless of how far along the collection we travel.
export default function WallPerspective({ scroll }) {
  const svg = useRef(null);
  useEffect(() => {
    const node = svg.current, host = scroll.current;
    const [wall, side, floor, backGrid, depthGrid] = node.children;
    function draw() {
      const w = node.clientWidth, h = node.clientHeight;
      if (!w || !h) return;
      const edge = w * .138 - host.scrollLeft, seam = h * .88;
      const cx = w / 2, cy = h * .46, cell = Math.max(24, Math.min(42, h / 22));
      const far = cx / (cx - edge);
      const leftSeam = cy + (seam - cy) * far;
      wall.setAttribute('d', `M${edge} 0 H${w} V${seam} H${edge} Z`);
      side.setAttribute('d', `M0 0 H${edge} V${seam} L0 ${leftSeam} Z`);
      floor.setAttribute('d', `M0 ${edge > 0 ? leftSeam : seam} L${Math.max(0,edge)} ${seam} H${w} V${h} H0 Z`);
      let back = '', depth = '';
      const bottom = (h - cy) / (seam - cy);
      for (let x = edge + Math.max(0, Math.floor(-edge / cell)) * cell; x <= w; x += cell) {
        back += `M${x} 0V${seam}`;
        depth += `M${x} ${seam}L${cx + (x-cx)*bottom} ${h}`;
      }
      for (let y = seam; y >= 0; y -= cell) {
        back += `M${Math.max(0,edge)} ${y}H${w}`;
        if (edge > 0) depth += `M${edge} ${y}L0 ${cy + (y-cy)*far}`;
      }
      for (let z = 1; z < 2; z += .065) {
        const k = 1/(2-z), x = cx + (edge-cx)*k, y = cy + (seam-cy)*k;
        if (y > h && x < 0) break;
        depth += `M${x} 0V${y}H${w}`;
      }
      backGrid.setAttribute('d',back);
      depthGrid.setAttribute('d',depth);
    }
    const observer = new ResizeObserver(draw);
    observer.observe(node); host.addEventListener('scroll', draw, { passive:true }); draw();
    return () => { observer.disconnect(); host.removeEventListener('scroll',draw); };
  }, [scroll]);
  return <svg ref={svg} className="wall-perspective" aria-hidden="true">
    <path className="wall-back"/><path className="wall-side"/><path className="wall-floor"/>
    <path className="wall-lines"/><path className="wall-depth-lines"/>
  </svg>;
}
