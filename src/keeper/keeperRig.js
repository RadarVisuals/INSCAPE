import { parseKeeperOctopusRig } from './keeperOctopusRig.js';
const SVG = 'http://www.w3.org/2000/svg';
const XLINK = 'http://www.w3.org/1999/xlink';
export const KEEPER_RIG_LIMITS = Object.freeze({ parts: 50, dimension: 4096, pixels: 16 * 1024 * 1024 });
const invalid = () => { throw new Error('Use a prepared Keeper SVG: image-layer tentacles, a segmented snake, or an octopus with a WebP head and vector tentacles and eyes.'); };

// Read a deliberately small data format, never insert imported SVG markup into
// the page. Only embedded raster pixels, bounded geometry, colors and role IDs
// reach the renderer; octopus paths use a separate restricted reader.
export function parseKeeperRig(svg) {
  const box = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  if (svg.namespaceURI !== SVG || box?.length !== 4 || !box.every(Number.isFinite)
    || box[2] <= 0 || box[3] <= 0 || Math.max(box[2], box[3]) > KEEPER_RIG_LIMITS.dimension) invalid();
  const root = [...svg.children].find(node => node.localName === 'g' && node.id === 'keeper');
  if (!root || root.hasAttribute('transform') || svg.hasAttribute('transform')) invalid();
  const kind = root.getAttribute('data-keeper-rig') || 'tentacles';
  if (kind === 'octopus') return parseKeeperOctopusRig(svg, root, box);
  if (!['tentacles', 'snake'].includes(kind)) invalid();
  const groups = [...root.children];
  if (groups.length < 2 || groups.length > (kind === 'snake' ? KEEPER_RIG_LIMITS.parts : 17)) invalid();
  const ids = new Set();
  const roles = kind === 'snake' ? /^(body|eye|segment-[1-9]\d?)$/ : /^(body|tentacle-[1-9]\d?)$/;
  const parts = groups.map(group => {
    if (group.localName !== 'g' || group.namespaceURI !== SVG || group.hasAttribute('transform')
      || group.hasAttribute('style') || ids.has(group.id) || !roles.test(group.id)) invalid();
    ids.add(group.id);
    const image = group.children[0];
    if (group.children.length !== 1 || image?.localName !== 'image' || image.namespaceURI !== SVG
      || image.hasAttribute('transform') || image.hasAttribute('style') || image.hasAttribute('clip-path') || image.hasAttribute('mask')) invalid();
    const src = image.getAttribute('href') || image.getAttributeNS(XLINK, 'href');
    if (!/^data:image\/(?:webp|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(src || '')) invalid();
    const geometry = Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, Number(image.getAttribute(key) || 0)]));
    const { x, y, width, height } = geometry;
    if (!Object.values(geometry).every(Number.isFinite) || width <= 0 || height <= 0
      || x < box[0] || y < box[1] || x + width > box[0] + box[2] || y + height > box[1] + box[3]) invalid();
    return { id: group.id, src, ...geometry };
  });
  if (!ids.has('body')) invalid();
  if (kind === 'snake') {
    const count = parts.length - 2;
    if (!ids.has('eye') || count < 2 || !Array.from({ length: count }, (_, i) => ids.has(`segment-${i + 1}`)).every(Boolean)) invalid();
    return createKeeperSnakeRig(parts);
  }
  return createKeeperRig(parts);
}

// The eye is the head's pivot. Segment numbers express chain order rather than
// paint order; derive each source tangent so already-curved art can straighten.
export function createKeeperSnakeRig(parts) {
  const eye = parts.find(part => part.id === 'eye');
  const cx = eye.x + eye.width / 2, cy = eye.y + eye.height / 2;
  const center = part => ({ ...part, x: part.x + part.width / 2 - cx, y: part.y + part.height / 2 - cy });
  const chain = parts.filter(part => part.id.startsWith('segment-'))
    .sort((a, b) => Number(a.id.slice(8)) - Number(b.id.slice(8))).map(center);
  let previous = { x: 0, y: 0 }, distance = 0;
  for (const part of chain) {
    const dx = previous.x - part.x, dy = previous.y - part.y;
    const gap = Math.hypot(dx, dy);
    if (gap < .01) invalid();
    distance += gap;
    part.distance = distance;
    part.sourceHeading = Math.atan2(dy, dx);
    previous = part;
  }
  const scale = .84 / (distance * 1.5 + Math.max(...parts.map(part => Math.hypot(part.width, part.height))) / 2);
  const body = center(parts.find(part => part.id === 'body'));
  return { kind: 'snake', sourceHeading: chain[0].sourceHeading,
    parts: [...chain, body, center(eye)].map(part => ({ ...part,
      x: part.x * scale, y: part.y * scale, width: part.width * scale, height: part.height * scale,
      ...(part.distance ? { distance: part.distance * scale } : {}),
    })) };
}

export function createKeeperRig(parts) {
  const body = parts.find(part => part.id === 'body');
  const cx = body.x + body.width / 2, cy = body.y + body.height / 2;
  // Fit every rotated rectangle, including a small idle/trailing margin, inside
  // the authored size envelope around the head's pivot. Tentacles may now orbit
  // independently without the screen bound pushing them across the head.
  const radius = Math.max(...parts.map(part => Math.hypot(part.x + part.width / 2 - cx, part.y + part.height / 2 - cy)
    + Math.hypot(part.width, part.height) / 2));
  const scale = .45 / radius;
  return { parts: [...parts.filter(part => part.id !== 'body'), body].map(part => ({
    id: part.id, src: part.src, x: (part.x + part.width / 2 - cx) * scale,
    y: (part.y + part.height / 2 - cy) * scale, width: part.width * scale, height: part.height * scale,
  })) };
}
