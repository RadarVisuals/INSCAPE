// Slide 1 contains all members without an explicit assignment.
export const slideOf = (cell, id) => (cell.slides || []).findIndex(slide => slide.includes(id)) + 1;
export const slideCount = cell => 1 + (cell.slides?.length || 0);
export const slideKey = cell => cell.swipeLink || cell.id;
export const slideIndex = (cell, positions) => Math.min(positions[slideKey(cell)] || 0, slideCount(cell) - 1);
// Unit offset of the incoming slide when advancing in the authored direction.
export const swipeOffsets = { left: [1, 0], right: [-1, 0], up: [0, 1], down: [0, -1] };
export const swipeOffset = cell => swipeOffsets[cell.swipeDirection || 'left'];
export function validSlides(cell) {
  if ('swipeDirection' in cell && (!cell.slides || !Object.hasOwn(swipeOffsets, cell.swipeDirection))) return false;
  if ('swipeLink' in cell && (!cell.slides || typeof cell.swipeLink !== 'string' || !/^swipe:[a-zA-Z0-9_-]{1,80}$/u.test(cell.swipeLink))) return false;
  if (!('slides' in cell)) return true;
  if (!Array.isArray(cell.slides) || !cell.slides.length || cell.slides.length >= 32 || cell.slides.some(slide => !Array.isArray(slide))) return false;
  const ids = cell.slides.flat();
  return ids.every(id => cell.members.includes(id)) && new Set(ids).size === ids.length;
}
export function assignSlide(cell, ids, index) {
  if (!Number.isInteger(index) || index < 0 || index >= slideCount(cell) || ids.some(id => !cell.members.includes(id))) throw Error('Choose an available slide and layer.');
  if (!cell.slides) return cell;
  return { ...cell, slides: cell.slides.map((slide, i) => [...slide.filter(id => !ids.includes(id)), ...(i + 1 === index ? ids : [])]) };
}
export function editCellSlides(value, id, action, argument, memberId) {
  const cell = value.cells.find(item => item.id === id);
  if (!cell) throw Error('Choose an available cell.');
  const peers = value.cells.filter(item => slideKey(item) === slideKey(cell));
  let cells;
  if (action === 'direction') {
    if (!cell.slides || !Object.hasOwn(swipeOffsets, argument)) throw Error('Choose a swipe direction for this cell.');
    const { swipeDirection, ...base } = cell;
    cells = value.cells.map(item => item !== cell ? item : argument === 'left' ? base : { ...base, swipeDirection: argument });
  } else if (action === 'assign') {
    if (cell.lockedMembers?.includes(memberId)) throw Error('Unlock this layer before changing its slide.');
    cells = value.cells.map(item => item === cell ? assignSlide(cell, [memberId], argument) : item);
  } else if (action === 'add') {
    if (peers.some(item => slideCount(item) >= 32)) throw Error('A cell can contain up to 32 slides.');
    cells = value.cells.map(item => peers.includes(item) ? { ...item, slides: [...(item.slides || []), []] } : item);
  } else if (action === 'remove') {
    if (peers.some(item => !item.slides || item.slides.at(-1).length)) throw Error('Move the layers off the last slide in each linked cell first.');
    cells = value.cells.map(item => {
      if (!peers.includes(item)) return item;
      const { slides, swipeLink, swipeDirection, ...base } = item;
      return slides.length === 1 ? base : { ...item, slides: slides.slice(0, -1) };
    });
  } else if (action === 'link') {
    const target = value.cells.find(item => item.id === argument);
    if (!target || target === cell) throw Error('Choose another cell to link.');
    const group = value.cells.filter(item => item === cell || slideKey(item) === slideKey(target));
    const count = Math.max(2, ...group.map(slideCount));
    const swipeLink = target.swipeLink || 'swipe:' + crypto.randomUUID();
    cells = value.cells.map(item => group.includes(item) ? { ...item, swipeLink,
      slides: Array.from({ length: count - 1 }, (_, i) => item.slides?.[i] || []) } : item);
  } else if (action === 'unlink') {
    const { swipeLink, ...standalone } = cell;
    cells = value.cells.map(item => item === cell ? standalone : item);
  } else throw Error('Unknown slide action.');
  return { ...value, cells: pruneSwipeLinks(cells) };
}
export function pruneSwipeLinks(cells) {
  return cells.map(cell => {
    if (!('swipeLink' in cell) || cell.swipeLink && cells.some(other => other !== cell && other.swipeLink === cell.swipeLink)) return cell;
    const { swipeLink, ...standalone } = cell;
    return standalone;
  });
}
