// Frame geometry is authored once on regions. A group retains only membership,
// direction and spacing; moving/resizing it updates its member regions together.
const EXTENT = 10000, MIN = 200;
export const RECEPTION_FRAME_CREATION_LIMIT = 8;
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const bounds = regions => {
  const x = Math.min(...regions.map(region => region.x)), y = Math.min(...regions.map(region => region.y));
  return { x, y, width: Math.max(...regions.map(region => region.x + region.width)) - x,
    height: Math.max(...regions.map(region => region.y + region.height)) - y };
};
export function validReceptionArrangement(value, regions) {
  if (!exact(value, ['groups']) || !Array.isArray(value.groups) || value.groups.length > Math.floor(regions.length / 2)) return false;
  const ids = new Set(regions.map(region => region.id)), grouped = new Set(), groups = new Set();
  return value.groups.every(group => {
    if (!exact(group, ['id', 'members', 'axis', 'gapX', 'gapY']) || typeof group.id !== 'string'
      || !/^group:[A-Za-z0-9_-]{1,80}$/u.test(group.id) || groups.has(group.id) || !['row', 'column'].includes(group.axis)
      || !integer(group.gapX, 0, EXTENT) || !integer(group.gapY, 0, EXTENT)
      || !Array.isArray(group.members) || group.members.length < 2 || group.members.length > regions.length) return false;
    groups.add(group.id);
    for (const id of group.members) {
      if (!ids.has(id) || grouped.has(id)) return false;
      grouped.add(id);
    }
    return true;
  });
}
export const receptionFrameGroup = (value, id) => value.arrangement?.groups.find(group => group.members.includes(id));
export function receptionFrameBounds(value, id) {
  const group = receptionFrameGroup(value, id), region = value.regions.find(item => item.id === id);
  if (!region) throw new Error('Select an available frame.');
  return group ? bounds(value.regions.filter(item => group.members.includes(item.id)))
    : { x: region.x, y: region.y, width: region.width, height: region.height };
}
export function pruneReceptionArrangement(arrangement, regionIds) {
  const ids = new Set(regionIds);
  return { groups: arrangement.groups.map(group => ({ ...group, members: group.members.filter(id => ids.has(id)) }))
    .filter(group => group.members.length > 1) };
}
export function detachReceptionFrames(value, viewport = { width: 1000, height: value.height }) {
  if (value.arrangement) return value;
  const width = Math.max(1, viewport.width), height = Math.max(1, viewport.height), gutter = value.gutter;
  // Convert the existing partition's painted gaps once, using its measured
  // viewport. Free frames thereafter need no inferred or extra gutter.
  const regions = value.regions.map(region => {
    const x = Math.round(region.x * (width + gutter) / width), y = Math.round(region.y * (height + gutter) / height);
    return { ...region, x: Math.min(x, EXTENT - MIN), y: Math.min(y, EXTENT - MIN),
      width: Math.max(MIN, Math.min(EXTENT - x, Math.round((region.width * (width + gutter) - gutter * EXTENT) / width))),
      height: Math.max(MIN, Math.min(EXTENT - y, Math.round((region.height * (height + gutter) - gutter * EXTENT) / height))) };
  });
  return { ...value, regions, mobile: value.mobile.map(item => ({ ...item, columns: 2 })), arrangement: { groups: [] } };
}
export function addReceptionFrame(value, viewport, id = `region:${crypto.randomUUID()}`) {
  if (value.regions.length >= RECEPTION_FRAME_CREATION_LIMIT)
    throw new Error(`Reception can add up to ${RECEPTION_FRAME_CREATION_LIMIT} frames. Existing larger layouts remain available.`);
  if (value.regions.some(region => region.id === id)) throw new Error('This frame already exists.');
  const next = detachReceptionFrames(value, viewport), offset = Math.min(2000, next.regions.length * 400);
  return { ...next, regions: [...next.regions, { id, x: offset, y: offset, width: 4000, height: 4000,
    content: null, padding: null, alignX: 'left', alignY: 'top', surface: null }],
  mobile: [...next.mobile, { id, columns: 2, height: 320 }] };
}
function requireFree(value) {
  if (!value.arrangement) throw new Error('Choose Free placement first.');
}
export function receptionGroupGapMaximum(value, group, axis = group.axis) {
  const frame = bounds(value.regions.filter(region => group.members.includes(region.id)));
  return Math.max(0, Math.floor(((axis === 'row' ? frame.width : frame.height) - group.members.length * MIN) / (group.members.length - 1)));
}
function arrange(value, group, frame) {
  const row = group.axis === 'row', dimension = row ? 'width' : 'height', coordinate = row ? 'x' : 'y';
  const members = group.members.map(id => value.regions.find(region => region.id === id));
  const gap = row ? group.gapX : group.gapY, available = frame[dimension] - (members.length - 1) * gap;
  if (available < members.length * MIN) throw new Error('The spacing leaves too little room for these frames. Enlarge the group or reduce the spacing.');
  const spare = available - members.length * MIN;
  const weights = members.map(region => Math.max(0, region[dimension] - MIN));
  const weight = weights.reduce((sum, value) => sum + value, 0) || members.length;
  let offset = 0, spentWeight = 0;
  const positioned = new Map(members.map((region, index) => {
    const previous = Math.round(spare * spentWeight / weight);
    spentWeight += weights.some(Boolean) ? weights[index] : 1;
    const size = MIN + Math.round(spare * spentWeight / weight) - previous;
    const next = { ...region, ...frame, [coordinate]: frame[coordinate] + offset, [dimension]: size };
    offset += size + (index < members.length - 1 ? gap : 0);
    return [region.id, next];
  }));
  return { ...value, regions: value.regions.map(region => positioned.get(region.id) || region) };
}
// Deleting a member keeps the surviving relationship meaningful immediately,
// rather than leaving a wider hole until the next time the group is edited.
export function reflowReceptionGroups(value) {
  return (value.arrangement?.groups || []).reduce((next, group) =>
    arrange(next, group, bounds(next.regions.filter(region => group.members.includes(region.id)))), value);
}
export function coupleReceptionFrames(value, ids, axis = 'row', id = `group:${crypto.randomUUID()}`) {
  requireFree(value);
  if (!['row', 'column'].includes(axis) || ids.length < 2 || new Set(ids).size !== ids.length
    || ids.some(id => !value.regions.some(region => region.id === id))) throw new Error('Select at least two available frames.');
  const group = { id, members: [...ids], axis, gapX: 0, gapY: 0 };
  const frame = bounds(value.regions.filter(region => ids.includes(region.id)));
  const next = arrange(value, group, frame);
  return { ...next, arrangement: { groups: [...value.arrangement.groups.filter(item => !item.members.some(member => ids.includes(member))), group] } };
}
export function unlinkReceptionFrames(value, id) {
  requireFree(value);
  return { ...value, arrangement: { groups: value.arrangement.groups.filter(group => group.id !== id && !group.members.includes(id)) } };
}
export function changeReceptionGroup(value, id, patch) {
  requireFree(value);
  if (Object.keys(patch).some(key => !['axis', 'gapX', 'gapY'].includes(key))) throw new Error('Choose a direction or spacing change.');
  const previous = value.arrangement.groups.find(group => group.id === id);
  if (!previous) throw new Error('This group is no longer available.');
  const group = { ...previous, ...patch };
  if (!['row', 'column'].includes(group.axis) || !integer(group.gapX, 0, EXTENT) || !integer(group.gapY, 0, EXTENT))
    throw new Error('Choose a valid direction and spacing.');
  const next = arrange(value, group, bounds(value.regions.filter(region => group.members.includes(region.id))));
  return { ...next, arrangement: { groups: value.arrangement.groups.map(item => item.id === id ? group : item) } };
}
// For a coupled member the patch addresses the whole group's derived bounds.
export function changeReceptionFrame(value, id, patch) {
  requireFree(value);
  if (Object.keys(patch).some(key => !['x', 'y', 'width', 'height'].includes(key))) throw new Error('Choose a position or size change.');
  const start = receptionFrameBounds(value, id), frame = { ...start, ...patch };
  if (Object.values(frame).some(value => !Number.isFinite(value))) throw new Error('Choose a valid frame position and size.');
  frame.width = clamp(Math.round(frame.width), MIN, EXTENT); frame.height = clamp(Math.round(frame.height), MIN, EXTENT);
  frame.x = clamp(Math.round(frame.x), 0, EXTENT - frame.width); frame.y = clamp(Math.round(frame.y), 0, EXTENT - frame.height);
  const group = receptionFrameGroup(value, id);
  return group ? arrange(value, group, frame) : { ...value, regions: value.regions.map(region => region.id === id ? { ...region, ...frame } : region) };
}
