// Positions use the editor's document coordinates. Slices are disposable views;
// the complete article is the only saved document (including marks and artwork).
export const articleNodeSize = node => node.type === 'text' ? node.text.length
  : ['artwork', 'hardBreak', 'horizontalRule', 'pageBreak'].includes(node.type) ? 1
    : (node.type === 'doc' ? 0 : 2) + (node.content || []).reduce((sum, child) => sum + articleNodeSize(child), 0);

export function articleFlowSlice(content, from = 0, to = articleNodeSize(content)) {
  const positions = new WeakMap();
  const visit = (node, start) => {
    const end = start + articleNodeSize(node);
    if (end <= from || start >= to) return null;
    let result = node;
    if (node.type === 'text') {
      const left = Math.max(start, from), right = Math.min(end, to);
      result = { ...node, text: node.text.slice(left - start, right - start) };
      positions.set(result, { from: left, to: right }); return result;
    }
    if (node.content) {
      let at = start + (node.type === 'doc' ? 0 : 1), first = -1;
      const children = node.content.flatMap((child, index) => {
        const next = visit(child, at); at += articleNodeSize(child);
        if (next && first < 0) first = index;
        return next ? [next] : [];
      });
      if (!children.length && node.content.length) return null;
      result = { ...node, content: children };
      if (node.type === 'orderedList' && first > 0) result.attrs = { ...node.attrs, start: (node.attrs?.start || 1) + first };
    } else result = { ...node };
    if (['paragraph', 'heading'].includes(node.type)) {
      if (from > start + 1) result.attrs = { ...result.attrs, spaceBefore: 0 };
      if (to < end - 1) result.attrs = { ...result.attrs, spaceAfter: 0 };
    }
    positions.set(result, { from: start, to: end, continued: from > start + 1 });
    return result;
  };
  return { content: visit(content, 0) || { type: 'doc', content: [] }, positions };
}

// Find the last complete line/atomic artwork fitting the frame. Text leaves are
// binary searched, so layout reads grow with blocks and log(text length).
export function fittingArticleEnd(body, from, total) {
  const box = body.getBoundingClientRect();
  const fits = rect => rect.left >= box.left - 1 && rect.right <= box.right + 1
    && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1;
  let end = from;
  for (const element of body.querySelectorAll('[data-flow-from]')) {
    const start = Number(element.dataset.flowFrom), stop = Number(element.dataset.flowTo);
    if (element.dataset.flowBreak !== undefined) return Math.max(from, stop);
    if (element.dataset.flowText === undefined) {
      if (![...element.getClientRects()].every(fits)) return end;
      end = stop; continue;
    }
    const text = element.firstChild;
    if (!text) continue;
    const range = document.createRange();
    const fitting = index => { range.setStart(text, index); range.setEnd(text, index + 1); return fits(range.getBoundingClientRect()); };
    if (fitting(text.length - 1)) { end = stop; continue; }
    let low = 0, high = text.length;
    while (low < high) { const mid = Math.floor((low + high) / 2); if (fitting(mid)) low = mid + 1; else high = mid; }
    return low ? start + low : end;
  }
  return total;
}
