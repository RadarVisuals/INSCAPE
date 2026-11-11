const SVG = 'http://www.w3.org/2000/svg';
const fail = () => { throw new Error('Use a prepared octopus Keeper with one embedded head, gradient tentacles and separate eyes.'); };
const color = value => { if (!/^#[0-9a-f]{6}$/i.test(value || '')) fail(); return value; };
const number = (node, key) => { const raw = node.getAttribute(key); if (!raw?.trim() || !Number.isFinite(Number(raw))) fail(); return Number(raw); };

// Deliberately limited drawing data. Imported nodes, styles, URLs and scripts
// never reach the page. The renderer creates its own scoped shapes and clips.
export function readOctopusPath(text) {
  if (typeof text !== 'string' || text.length > 16000) fail();
  const tokens = text.match(/[MLCZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) || [];
  if (text.replace(/[MLCZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?|[\s,]/g, '') || tokens[0] !== 'M') fail();
  const commands = [];
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i++], count = { M: 2, L: 2, C: 6, Z: 0 }[command];
    if (count === undefined || i + count > tokens.length || commands.length >= 256) fail();
    const values = tokens.slice(i, i + count).map(Number); i += count;
    if (!values.every(value => Number.isFinite(value) && Math.abs(value) <= 16384)) fail();
    commands.push([command, ...values]);
  }
  if (commands.length < 3 || commands.at(-1)[0] !== 'Z') fail();
  return commands;
}
export const octopusPath = commands => commands.map(([command, ...values]) => command + values.map(n => +n.toFixed(3)).join(' ')).join(' ');
export const mapOctopusPath = (commands, map) => commands.map(([command, ...values]) => {
  const result = [command];
  for (let i = 0; i < values.length; i += 2) result.push(...map(values[i], values[i + 1]));
  return result;
});
const bounds = commands => {
  const points = commands.flatMap(([, ...values]) => Array.from({ length: values.length / 2 }, (_, i) => ({ x: values[i * 2], y: values[i * 2 + 1] })));
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
};
function shape(node) {
  if (node?.localName !== 'path' || node.children.length) fail();
  const opacity = node.hasAttribute('fill-opacity') ? number(node, 'fill-opacity') : 1;
  if (opacity < 0 || opacity > 1) fail();
  return { commands: readOctopusPath(node.getAttribute('d')), fill: color(node.getAttribute('fill')), opacity };
}

export function parseKeeperOctopusRig(svg, root, box) {
  const allowed = new Set(['svg', 'title', 'desc', 'defs', 'linearGradient', 'stop', 'clipPath', 'g', 'path', 'image']);
  const all = [svg, ...svg.querySelectorAll('*')];
  if (all.length > 160) fail();
  for (const node of all) {
    if (node.namespaceURI !== SVG || !allowed.has(node.localName)) fail();
    for (const attribute of node.attributes) {
      if (/^on/i.test(attribute.name) || ['style', 'transform', 'filter', 'mask'].includes(attribute.name)) fail();
    }
  }
  const groups = [...root.children], ids = new Set();
  if (groups.length < 3 || groups.length > 13) fail();
  for (const group of groups) {
    if (group.localName !== 'g' || ids.has(group.id) || !/^(body|tentacle-[1-8]|eye-[1-4])$/.test(group.id)) fail();
    ids.add(group.id);
  }
  const bodyGroup = groups.find(g => g.id === 'body'), image = bodyGroup?.children[0];
  if (!bodyGroup || bodyGroup.children.length !== 1 || image?.localName !== 'image') fail();
  const src = image.getAttribute('href');
  if (!/^data:image\/(?:webp|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(src || '')) fail();
  const body = Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, number(image, key)]));
  if (body.width <= 0 || body.height <= 0 || body.x < box[0] || body.y < box[1]
    || body.x + body.width > box[0] + box[2] || body.y + body.height > box[1] + box[3]) fail();
  const tentacles = groups.filter(g => g.id.startsWith('tentacle-')).map(group => {
    if (group.children.length !== 1 || group.children[0].localName !== 'path') fail();
    const root = { x: number(group, 'data-root-x'), y: number(group, 'data-root-y') };
    const tip = { x: number(group, 'data-tip-x'), y: number(group, 'data-tip-y') };
    const length = Math.hypot(tip.x - root.x, tip.y - root.y);
    if (length < 10 || length > box[3] * 2 || [root, tip].some(p => p.x < box[0] || p.y < box[1] || p.x > box[0] + box[2] || p.y > box[1] + box[3])) fail();
    const gradient = svg.querySelector(`defs > linearGradient[id="${group.id}-gradient"]`);
    if (!gradient || gradient.getAttribute('gradientUnits') !== 'userSpaceOnUse' || gradient.children.length < 2 || gradient.children.length > 8
      || group.children[0].getAttribute('fill') !== `url(#${group.id}-gradient)`) fail();
    let previous = -1;
    const stops = [...gradient.children].map(stop => {
      const offset = number(stop, 'offset');
      if (stop.localName !== 'stop' || offset < previous || offset < 0 || offset > 1) fail();
      previous = offset;
      return { offset, color: color(stop.getAttribute('stop-color')) };
    });
    if (stops[0].offset !== 0 || stops.at(-1).offset !== 1) fail();
    return { id: group.id, root, tip, stops, commands: readOctopusPath(group.children[0].getAttribute('d')) };
  });
  const eyes = groups.filter(g => g.id.startsWith('eye-')).map(group => {
    const children = [...group.children], roles = children.map(node => node.getAttribute('data-role'));
    if (children.length < 3 || children.length > 4 || new Set(roles).size !== roles.length
      || roles.some(role => !['aperture', 'gaze', 'lid-top', 'lid-bottom'].includes(role))) fail();
    const aperture = shape(children.find(node => node.getAttribute('data-role') === 'aperture'));
    const gaze = children.find(node => node.getAttribute('data-role') === 'gaze');
    if (gaze?.localName !== 'g' || gaze.children.length < 1 || gaze.children.length > 6 || !roles.includes('lid-top')) fail();
    return { id: group.id, aperture, gaze: [...gaze.children].map(shape),
      lids: children.filter(node => node.getAttribute('data-role').startsWith('lid-')).map(node => ({ ...shape(node), role: node.getAttribute('data-role') })) };
  });
  for (const [list, prefix] of [[tentacles, 'tentacle'], [eyes, 'eye']]) {
    if (!list.length || !Array.from({ length: list.length }, (_, i) => ids.has(`${prefix}-${i + 1}`)).every(Boolean)) fail();
  }
  // The head is the pivot. Include curve handles and deformation room in the
  // screen-size envelope, preserving the dock's existing viewport bounds.
  const cx = body.x + body.width / 2, cy = body.y + body.height / 2;
  let radius = Math.hypot(body.width, body.height) / 2;
  for (const tentacle of tentacles) for (const [, ...values] of tentacle.commands)
    for (let i = 0; i < values.length; i += 2) radius = Math.max(radius, Math.hypot(values[i] - cx, values[i + 1] - cy));
  const scale = 420 / radius, map = (x, y) => [(x - cx) * scale, (y - cy) * scale];
  const mappedShape = part => {
    const commands = mapOctopusPath(part.commands, map);
    return { ...part, commands, d: octopusPath(commands) };
  };
  const point = p => { const [x, y] = map(p.x, p.y); return { x, y }; };
  const checkEye = eye => {
    const b = bounds(eye.aperture.commands);
    if (b.right <= b.left || b.bottom <= b.top || b.left < body.x || b.top < body.y || b.right > body.x + body.width || b.bottom > body.y + body.height) fail();
    const aperture = mappedShape(eye.aperture), local = bounds(aperture.commands);
    return { ...eye, aperture, gaze: eye.gaze.map(mappedShape), lids: eye.lids.map(mappedShape), bounds: local,
      center: { x: (local.left + local.right) / 2, y: (local.top + local.bottom) / 2 } };
  };
  return { kind: 'octopus', parts: [{ id: 'body', src }],
    body: { id: 'body', src, x: -body.width * scale / 2, y: -body.height * scale / 2, width: body.width * scale, height: body.height * scale },
    colors: { start: color(root.getAttribute('data-goo-start')), end: color(root.getAttribute('data-goo-end')) },
    tentacles: tentacles.map(t => ({ ...mappedShape(t), root: point(t.root), tip: point(t.tip) })), eyes: eyes.map(checkEye) };
}
