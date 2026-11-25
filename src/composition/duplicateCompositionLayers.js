import { ARTWORK_KEYS, artworkLocked, layerMembers } from '../systemWorkflow/domain/artworkLayers.js';
import { MAX_SHAPES } from '../shapes/shapes.js';
import { MAX_IMAGE_MODULES } from '../imageModule/imageModule.js';
import { MAX_TEXT_MODULES } from '../text/domain/article.js';
import { slideOf, slideIndex, slideKey, slideCount } from './cellSlides.js';
import { compositionModuleWindow, withCompositionModuleWindow, COMPOSITION_CELL_LIMIT } from './compositionEditorDocument.js';

const limits = { shapes: MAX_SHAPES, imageModules: MAX_IMAGE_MODULES, texts: MAX_TEXT_MODULES };

// Build the entire copy before committing, including references internal to
// copied cells and groups. Asset references continue to use the existing media.
export function duplicateCompositionLayers(value, selection, delta, destination, positions) {
  if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) throw Error('Choose a valid drop position.');
  const selected = new Set(selection);
  if (!selected.size || selection.some(id => artworkLocked(value, id))) throw Error('Select unlocked artwork to duplicate.');
  const cells = value.cells.filter(cell => selected.has(cell.id));
  if (cells.length && value.cells.length + cells.length > COMPOSITION_CELL_LIMIT) throw Error('This selection exceeds the cell limit.');
  const sources = new Set([...selected, ...cells.flatMap(cell => cell.members)]);
  const ids = new Map([...sources].map(id => [id, id.split(':')[0] + ':' + crypto.randomUUID()]));
  const copyId = id => ids.get(id);
  const copies = members => members.filter(id => ids.has(id)).map(copyId);
  const next = { ...value, workbench: { ...value.workbench } };
  for (const key of ARTWORK_KEYS) {
    const originals = value[key].filter(item => ids.has(item.id));
    if (value[key].length + originals.length > limits[key]) throw Error('This selection exceeds the ' + key + ' limit (' + limits[key] + ').');
    next[key] = [...value[key], ...originals.map(item => ({ ...structuredClone(item), id: copyId(item.id) }))];
    next.workbench[key] = [...(value.workbench[key] || []), ...(value.workbench[key] || []).filter(item => ids.has(item.id))
      .map(item => ({ ...structuredClone(item), id: copyId(item.id) }))];
  }
  const copiedContents = new Set(cells.flatMap(cell => cell.members));
  const movable = selection.filter(id => !cells.some(cell => cell.id === id) && !copiedContents.has(id));
  const target = value.cells.find(cell => cell.id === destination);
  if (destination && !target) throw Error('The destination cell is no longer available.');
  next.cells = value.cells.map(cell => {
    const added = movable.filter(id => destination === undefined ? cell.members.includes(id) : cell === target);
    if (!added.length) return cell;
    return { ...cell, members: [...cell.members, ...added.map(copyId)],
      ...(cell.slides && { slides: cell.slides.map((slide, i) => [...slide, ...added.filter(id =>
        (cell.members.includes(id) ? slideOf(cell, id) : slideIndex(cell, positions)) === i + 1).map(copyId)]) }),
      ...(cell.fitText && { fitText: [...cell.fitText, ...added.filter(id => cell.fitText.includes(id)).map(copyId)] }) };
  });
  for (const cell of cells) {
    next.cells.push({ ...structuredClone(cell), id: copyId(cell.id), members: copies(cell.members),
      ...(cell.slides && { slides: cell.slides.map(copies) }),
      ...(cell.lockedMembers && { lockedMembers: copies(cell.lockedMembers) }),
      ...(cell.fitText && { fitText: copies(cell.fitText) }),
      ...(cell.memberAnchors && { memberAnchors: cell.memberAnchors.map(a => ({ ...a, members: copies(a.members) })) }),
      mobile: { ...cell.mobile, ...(cell.mobile.placements && { placements: cell.mobile.placements.map(p => ({ ...p, id: copyId(p.id) })) }) } });
  }
  const layers = value.artworkLayers.flatMap(layer => {
    const children = copies(layerMembers(layer));
    if (typeof layer === 'string' || children.length !== layer.children.length) return children;
    return [{ ...layer, id: 'composition:' + crypto.randomUUID(), children,
      ...(layer.stackPosition && { stackPosition: { left: layer.stackPosition.left + delta.x, top: layer.stackPosition.top + delta.y } }) }];
  });
  next.artworkLayers = [...value.artworkLayers, ...layers];
  if (value.arrangement) next.arrangement = { groups: [...value.arrangement.groups, ...value.arrangement.groups.filter(g => g.members.every(id => ids.has(id)))
    .map(g => ({ ...g, id: 'group:' + crypto.randomUUID(), members: copies(g.members) }))] };
  let placed = next;
  for (const id of sources) {
    const frame = compositionModuleWindow(value, id);
    if (!frame) throw Error('The selected artwork is no longer available.');
    placed = withCompositionModuleWindow(placed, copyId(id), { ...frame, left: frame.left + delta.x, top: frame.top + delta.y });
  }
  return { value: placed, selection: [...selected].map(copyId) };
}


export function duplicateCompositionSlide(value, cellId, index) {
  const cell = value.cells.find(item => item.id === cellId);
  if (!cell || !Number.isInteger(index) || index < 0 || index >= slideCount(cell)) throw Error('Choose an available slide.');
  if (slideCount(cell) >= 32) throw Error('A cell can contain up to 32 slides.');
  const peers = value.cells.filter(item => slideKey(item) === slideKey(cell));
  const sources = peers.flatMap(item => item.members.filter(id => slideOf(item, id) === index));
  const result = sources.length
    ? duplicateCompositionLayers(value, sources, { x: 0, y: 0 }, undefined, {})
    : { value, selection: [] };
  const ids = new Map(sources.map((id, i) => [id, result.selection[i]]));
  const copies = members => members.filter(id => ids.has(id)).map(id => ids.get(id));
  const cells = result.value.cells.map(item => {
    const original = peers.find(peer => peer.id === item.id);
    if (!original) return item;
    const slides = [...(original.slides || [])];
    slides.splice(index, 0, copies(original.members));
    const mobile = original.mobile;
    return { ...item, slides,
      ...(original.memberAnchors && { memberAnchors: [...original.memberAnchors, ...original.memberAnchors
        .map(anchor => ({ ...anchor, members: copies(anchor.members) })).filter(anchor => anchor.members.length)] }),
      ...(mobile.placements && { mobile: { ...mobile, placements: [...mobile.placements, ...mobile.placements
        .filter(p => ids.has(p.id)).map(p => ({ ...p, id: ids.get(p.id) }))] } }) };
  });
  return { ...result.value, cells };
}
