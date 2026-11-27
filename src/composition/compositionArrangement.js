import { exact } from '../text/domain/article.js';
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
export function validCompositionArrangement(value, regions) {
  if (!exact(value, ['groups']) || !Array.isArray(value.groups) || value.groups.length > Math.floor(regions.length / 2)) return false;
  const ids = new Set(regions.map(region => region.id)), grouped = new Set(), groups = new Set();
  return value.groups.every(group => {
    if (!exact(group, ['id', 'members', 'axis', 'gapX', 'gapY']) || typeof group.id !== 'string'
      || !/^group:[A-Za-z0-9_-]{1,80}$/u.test(group.id) || groups.has(group.id) || !['row', 'column'].includes(group.axis)
      || !integer(group.gapX, 0, 10000) || !integer(group.gapY, 0, 10000)
      || !Array.isArray(group.members) || group.members.length < 2 || group.members.length > regions.length) return false;
    groups.add(group.id);
    for (const id of group.members) {
      if (!ids.has(id) || grouped.has(id)) return false;
      grouped.add(id);
    }
    return true;
  });
}
export function pruneCompositionArrangement(arrangement, regionIds) {
  const ids = new Set(regionIds);
  return { groups: arrangement.groups.map(group => ({ ...group, members: group.members.filter(id => ids.has(id)) }))
    .filter(group => group.members.length > 1) };
}
