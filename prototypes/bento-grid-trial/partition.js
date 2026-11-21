// Authored relationships live in this tree; pixel rectangles are derived views.
export const leaves = tree => typeof tree === 'string' ? [tree] : [...leaves(tree.first), ...leaves(tree.second)];
export const split = (axis, first, second, ratio = .5) => ({ axis, ratio, first, second });
export function validTree(tree, content, depth = 0) {
  if (depth > 64) return false;
  if (typeof tree === 'string') return Object.hasOwn(content, tree);
  return !!tree && ['x', 'y'].includes(tree.axis) && Number.isFinite(tree.ratio) && tree.ratio >= .15 && tree.ratio <= .85
    && validTree(tree.first, content, depth + 1) && validTree(tree.second, content, depth + 1);
}
const map = (tree, fn) => typeof tree === 'string' ? fn(tree) : { ...tree, first: map(tree.first, fn), second: map(tree.second, fn) };
function remove(tree, id) {
  if (typeof tree === 'string') return tree === id ? null : tree;
  const first = remove(tree.first, id), second = remove(tree.second, id);
  return first === null ? second : second === null ? first : { ...tree, first, second };
}
export function moveCell(tree, id, destination) {
  const ids = leaves(tree);
  if (!ids.includes(id) || ids.length < 2) throw Error('Kies een bestaande cel.');
  if (!destination || !['swap', 'cell', 'root'].includes(destination.kind)) throw Error('Kies een bestemming.');
  const { kind, target, side } = destination;
  if (kind !== 'root' && (!ids.includes(target) || target === id)) throw Error('Kies een andere cel.');
  if (kind === 'swap') return map(tree, key => key === id ? target : key === target ? id : key);
  if (!['left', 'right', 'top', 'bottom'].includes(side)) throw Error('Kies een celrand.');
  const remaining = remove(tree, id);
  const insert = node => split(['left', 'right'].includes(side) ? 'x' : 'y',
    ['left', 'top'].includes(side) ? id : node, ['left', 'top'].includes(side) ? node : id);
  return kind === 'root' ? insert(remaining) : map(remaining, key => key === target ? insert(key) : key);
}
export function setRatio(tree, path, ratio) {
  if (typeof tree === 'string') throw Error('Deze scheiding bestaat niet.');
  if (!path.length) return { ...tree, ratio: Math.max(.15, Math.min(.85, ratio)) };
  const [key, ...rest] = path;
  if (!['first', 'second'].includes(key)) throw Error('Ongeldige scheiding.');
  return { ...tree, [key]: setRatio(tree[key], rest, ratio) };
}

const MIN_WIDTH = 220, GAP = 12;
const minWidth = node => typeof node === 'string' ? MIN_WIDTH : node.axis === 'x'
  ? minWidth(node.first) + minWidth(node.second) : Math.max(minWidth(node.first), minWidth(node.second));
const direction = (node, width) => node.axis === 'x' && minWidth(node) > width ? 'y' : node.axis;
const clampSplit = (total, ratio, a, b) => Math.max(a, Math.min(total - b, total * ratio));

// Horizontal groups that become too narrow stack locally; type never scales.
export function projectDocument(doc, width, textHeight = () => 160) {
  if (!Number.isFinite(width) || width < 1) throw Error('Ongeldige vensterbreedte.');
  const measured = new Map();
  function minimum(node, w) {
    const key = JSON.stringify([node, w]);
    if (measured.has(key)) return measured.get(key);
    let value;
    if (typeof node === 'string') value = doc.content[node].image ? 300 : Math.max(160, textHeight(doc.content[node].text, Math.max(1, w - GAP - 40)) + 96);
    else if (direction(node, w) === 'y') value = minimum(node.first, w) + minimum(node.second, w);
    else {
      const a = clampSplit(w, node.ratio, minWidth(node.first), minWidth(node.second));
      value = Math.max(minimum(node.first, a), minimum(node.second, w - a));
    }
    measured.set(key, value); return value;
  }
  const height = Math.max(width * 900 / 1440, minimum(doc.tree, width)), frames = [], dividers = [];
  let stacked = 0;
  function arrange(node, rect, path = []) {
    if (typeof node === 'string') { frames.push({ id: node, ...rect }); return; }
    const axis = direction(node, rect.width);
    if (axis !== node.axis) stacked++;
    const horizontal = axis === 'x', total = horizontal ? rect.width : rect.height;
    const a = horizontal ? minWidth(node.first) : minimum(node.first, rect.width);
    const b = horizontal ? minWidth(node.second) : minimum(node.second, rect.width);
    const size = clampSplit(total, node.ratio, a, b);
    const first = horizontal ? { ...rect, width: size } : { ...rect, height: size };
    const second = horizontal ? { ...rect, left: rect.left + size, width: total - size }
      : { ...rect, top: rect.top + size, height: total - size };
    dividers.push({ path, axis, rect, position: (horizontal ? rect.left : rect.top) + size, ratio: node.ratio });
    arrange(node.first, first, [...path, 'first']); arrange(node.second, second, [...path, 'second']);
  }
  arrange(doc.tree, { left: 0, top: 0, width, height });
  return { frames, dividers, width, height, stacked };
}

export function dropTarget(projection, id, point) {
  const { x, y } = point, { width, height, frames } = projection;
  if (x < -12 || y < -12 || x > width + 12 || y > height + 12) return null;
  const outer = [['left', Math.abs(x)], ['right', Math.abs(width - x)], ['top', Math.abs(y)], ['bottom', Math.abs(height - y)]]
    .sort((a, b) => a[1] - b[1])[0];
  if (outer[1] <= 12) return { kind: 'root', side: outer[0] };
  const frame = frames.find(r => x >= r.left && x <= r.left + r.width && y >= r.top && y <= r.top + r.height);
  if (!frame || frame.id === id) return null;
  const edge = [['left', x - frame.left], ['right', frame.left + frame.width - x],
    ['top', y - frame.top], ['bottom', frame.top + frame.height - y]].sort((a, b) => a[1] - b[1])[0];
  const threshold = Math.min(44, frame.width * .22, frame.height * .22);
  return edge[1] <= threshold ? { kind: 'cell', target: frame.id, side: edge[0] } : { kind: 'swap', target: frame.id };
}

export function sampleDocument(count = 3) {
  if (count === 3) return { tree: split('x', 'artwork', split('y', 'quote', 'detail')), content: {
    artwork: { name: 'Artwork', color: '#d6d2c9', text: 'HUMAN UNDERNEATH', image: '/assets/characters/01/lineart.webp' },
    quote: { name: 'Tekst', color: '#353d39', text: "People think I'm the grim reaper but little do they know he only shows up when the work is already done." },
    detail: { name: 'Tweede rechtercel', color: '#252b2e', text: 'Sleep naar het midden om te wisselen. Sleep naar een rand om daar in te voegen.' },
  } };
  if (count !== 49) throw Error('Onbekend voorbeeld.');
  const sequence = (axis, ids) => ids.length === 1 ? ids[0] : (() => {
    const n = Math.floor(ids.length / 2);
    return split(axis, sequence(axis, ids.slice(0, n)), sequence(axis, ids.slice(n)), n / ids.length);
  })();
  const content = Object.fromEntries(Array.from({ length: 49 }, (_, i) => [`cell-${i + 1}`, {
    name: `Cel ${i + 1}`, color: ['#353d39', '#252b2e', '#3b343c'][i % 3],
    text: `Cel ${i + 1}\nDeze tekst blijft 16 px. Maak het venster smaller: de cellen schuiven onder elkaar en de pagina wordt langer.`,
  }]));
  const rows = Array.from({ length: 7 }, (_, y) => sequence('x', Array.from({ length: 7 }, (_, x) => `cell-${y * 7 + x + 1}`)));
  return { tree: sequence('y', rows), content };
}
