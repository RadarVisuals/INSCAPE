import { projectReceptionCellMembers } from '../../src/reception/editorCellGeometry.js';
import { fitNativeMediaRectangle } from '../../src/lattice/rendering/latticeGeometry.js';
import { projectCroppedMediaRectangle } from '../../src/lattice/rendering/latticeCrop.js';

const reference = { left: 0, top: 0, width: 600, height: 600 };
const members = {
  nomad: { left: 24, top: 60, width: 410, height: 520 },
  eye: { left: 370, top: 55, width: 200, height: 200 },
};
export function projectLayerStudy(width, height, mode = 'relative', anchor = 'bottom', fit = 'contain') {
  const frame = { left: 0, top: 0, width, height };
  const cell = mode === 'anchored' ? { memberAnchors: [
    { members: ['nomad'], alignX: 'left', alignY: anchor, paddingX: 16, paddingY: 16 },
    { members: ['eye'], alignX: 'right', alignY: 'top', paddingX: 16, paddingY: 16 },
  ] } : {};
  const boxes = projectReceptionCellMembers(reference, frame, members, cell);
  const place = (box, media) => fit === 'cover'
    ? projectCroppedMediaRectangle(box, media, { x: .5, y: .5, zoom: 1 })
    : fitNativeMediaRectangle(box, media);
  return Object.entries(boxes).map(([id, box]) => ({ id, box,
    image: place({ left: 0, top: 0, width: box.width, height: box.height }, id === 'nomad' ? { width: 1868, height: 1999 } : { width: 2000, height: 2000 }),
  }));
}

export function createLayerScene(React) {
  const h = React.createElement;
  return function LayerScene({ mode, anchor, fit, outlines }) {
    const host = React.useRef(null), uid = React.useId().replace(/:/g, '');
    const [size, setSize] = React.useState(null);
    React.useEffect(() => {
      const observer = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setSize({ width, height });
      });
      observer.observe(host.current); return () => observer.disconnect();
    }, []);
    return h('div', { className: 'layer-scene', ref: host }, size && h('svg', {
      width: '100%', height: '100%', viewBox: '0 0 ' + size.width + ' ' + size.height,
      role: 'img', 'aria-label': 'Lagenproef: achtergrond, Nomad en Abyssal Eye',
    }, h('image', { href: '/assets/stage/backdrops/backdrop_darkgrey.webp', width: size.width, height: size.height, preserveAspectRatio: 'xMidYMid slice' }),
    ...projectLayerStudy(size.width, size.height, mode, anchor, fit).map(({ id, box, image }) => {
      const clipId = uid + '-' + id;
      const art = id === 'nomad' ? h('svg', { x: image.left, y: image.top, width: image.width, height: image.height, viewBox: '204 -29 1868 1999', preserveAspectRatio: 'none' },
        h('image', { href: './assets/black-silhouette.webp', x: 204, y: 110, width: 1205, height: 1860, preserveAspectRatio: 'none' }),
        h('image', { href: './assets/light-foreground.webp', x: 209, y: -29, width: 1863, height: 1998, preserveAspectRatio: 'none' }))
        : h('image', { href: '/assets/actors/abyssal_eye/full.webp', x: image.left, y: image.top, width: image.width, height: image.height, preserveAspectRatio: 'none' });
      return h('g', { key: id, transform: 'translate(' + box.left + ' ' + box.top + ')', 'data-layer': id },
        h('defs', {}, h('clipPath', { id: clipId }, h('rect', { width: box.width, height: box.height }))),
        h('g', { clipPath: 'url(#' + clipId + ')' }, art),
        outlines && h('rect', { width: box.width, height: box.height, fill: 'none', stroke: '#00ff9f', strokeWidth: 1, strokeDasharray: '5 4' }));
    })));
  };
}
