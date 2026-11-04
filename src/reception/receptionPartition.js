// Shared edges are derived from authored rectangles, including T junctions.
// No persisted split tree or duplicate layout is needed.
export function inferredCellGap(frames) {
  const gaps = frames.flatMap(a => frames.flatMap(b => {
    if (a === b) return [];
    return [a.top < b.top + b.height && b.top < a.top + a.height ? b.left - a.left - a.width : -1,
      a.left < b.left + b.width && b.left < a.left + a.width ? b.top - a.top - a.height : -1].filter(gap => gap >= 0);
  }));
  return Math.min(256, ...(gaps.length ? gaps : [24]));
}

export function partitionDividers(regions, minimum = {}) {
  const found = new Map();
  for (const axis of ['x', 'y']) {
    const cross = axis === 'x' ? 'y' : 'x', size = axis === 'x' ? 'width' : 'height', crossSize = axis === 'x' ? 'height' : 'width';
    for (const seed of regions) {
      const position = seed[axis] + seed[size];
      let from = seed[cross], to = from + seed[crossSize], previous, members;
      do {
        previous = `${from}:${to}`;
        members = regions.filter(r => (r[axis] === position || r[axis] + r[size] === position)
          && Math.max(from, r[cross]) < Math.min(to, r[cross] + r[crossSize]));
        from = Math.min(from, ...members.map(r => r[cross])); to = Math.max(to, ...members.map(r => r[cross] + r[crossSize]));
      } while (previous !== `${from}:${to}`);
      const before = members.filter(r => r[axis] + r[size] === position), after = members.filter(r => r[axis] === position);
      // An outside edge or an incomplete strip cannot resize its neighbours.
      if ([before, after].some(side => side.reduce((sum, r) => sum + r[crossSize], 0) !== to - from)) continue;
      const id = `${axis}:${before.map(r => r.id).sort().join(',')}:${after.map(r => r.id).sort().join(',')}`;
      found.set(id, { id, axis, position, from, to, before: before.map(r => r.id), after: after.map(r => r.id),
        min: Math.max(...before.map(r => r[axis] + minimum[axis])), max: Math.min(...after.map(r => r[axis] + r[size] - minimum[axis])) });
    }
  }
  return [...found.values()];
}

// Paint shared edges, including edges too small to resize. Expand neighbouring
// sides to the gutter midpoint; outer sides stay at their authored boundary.
export function partitionInnerLines(regions, gap = 0) {
  const near = (a, b) => Math.abs(a - b) < 0.001;
  const overlap = (a, b, axis, size) => Math.min(a[axis] + a[size], b[axis] + b[size]) - Math.max(a[axis], b[axis]) > 0.001;
  const adjacent = (a, b, axis, size, cross, crossSize) => near(a[axis] + a[size] + gap, b[axis]) && overlap(a, b, cross, crossSize);
  const expanded = regions.map(a => {
    const left = regions.some(b => b !== a && adjacent(b, a, 'x', 'width', 'y', 'height')) ? gap / 2 : 0;
    const right = regions.some(b => b !== a && adjacent(a, b, 'x', 'width', 'y', 'height')) ? gap / 2 : 0;
    const top = regions.some(b => b !== a && adjacent(b, a, 'y', 'height', 'x', 'width')) ? gap / 2 : 0;
    const bottom = regions.some(b => b !== a && adjacent(a, b, 'y', 'height', 'x', 'width')) ? gap / 2 : 0;
    return { x: a.x - left, y: a.y - top, width: a.width + left + right, height: a.height + top + bottom };
  });
  const lines = [];
  for (const axis of ['x', 'y']) {
    const size = axis === 'x' ? 'width' : 'height', cross = axis === 'x' ? 'y' : 'x', crossSize = axis === 'x' ? 'height' : 'width';
    const segments = [];
    regions.forEach((a, i) => regions.forEach((b, j) => {
      if (i === j || !adjacent(a, b, axis, size, cross, crossSize)) return;
      const first = expanded[i], second = expanded[j];
      segments.push({ axis, position: a[axis] + a[size] + gap / 2,
        from: Math.max(first[cross], second[cross]), to: Math.min(first[cross] + first[crossSize], second[cross] + second[crossSize]) });
    }));
    segments.sort((a, b) => near(a.position, b.position) ? a.from - b.from : a.position - b.position);
    for (const segment of segments) {
      const previous = lines.at(-1);
      if (previous?.axis === axis && near(previous.position, segment.position) && segment.from <= previous.to + 0.001)
        previous.to = Math.max(previous.to, segment.to);
      else lines.push(segment);
    }
  }
  return lines;
}
