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
export function pruneSwipeLinks(cells) {
  return cells.map(cell => {
    if (!('swipeLink' in cell) || cell.swipeLink && cells.some(other => other !== cell && other.swipeLink === cell.swipeLink)) return cell;
    const { swipeLink, ...standalone } = cell;
    return standalone;
  });
}
