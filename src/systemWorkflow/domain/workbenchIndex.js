import { validWorkbenchGroupName } from './workbenchGroups.js';

export const MAX_WORKBENCH_DESTINATIONS = 32;
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const exact = (value, required, optional = []) => record(value) && required.every(key => Object.hasOwn(value, key))
  && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
const coordinate = value => Number.isFinite(value) && Math.abs(value) <= 1e7;
const position = value => exact(value, ['left', 'top']) && coordinate(value.left) && coordinate(value.top);
export const validWorkbenchViewRegion = value => exact(value, ['left', 'top', 'width', 'height'])
  && coordinate(value.left) && coordinate(value.top)
  && [value.width, value.height].every(n => Number.isFinite(n) && n > 0 && n <= 1e7);

export function workbenchDestinationAnchor(content, follow, getFrame) {
  const groups = Array.isArray(content?.workbenchGroups) ? content.workbenchGroups : [];
  const group = groups.find(item => item?.id === follow?.groupId);
  if (!Array.isArray(group?.memberIds) || !follow) return null;
  const texts = Array.isArray(content.workbench?.texts) ? content.workbench.texts : [];
  const ids = group.memberIds.flatMap(id => {
    const text = texts.find(item => item?.id === id);
    return [id, ...(Array.isArray(text?.frames) ? text.frames.map(frame => frame?.id) : [])];
  });
  if (!ids.includes(follow.anchorId)) return null;
  if (group.position) return group.position;
  const live = getFrame?.(follow.anchorId);
  if (live) return { left: live.left, top: live.top };
  const layout = content.workbench;
  if (follow.anchorId === 'display:primary') return layout?.display?.window || layout?.display?.position || null;
  for (const key of ['shapes', 'imageModules', 'texts', 'displays']) {
    for (const item of Array.isArray(layout?.[key]) ? layout[key] : []) {
      if (!record(item)) continue;
      if (item.id === follow.anchorId) return item.window || item.position || null;
      const frame = Array.isArray(item.frames) && item.frames.find(frame => frame?.id === follow.anchorId);
      if (frame) return frame.window || frame.position || null;
    }
  }
  return null;
}

export function resolveWorkbenchDestination(destination, content, getFrame) {
  if (!destination) return null;
  const anchor = destination.follow && workbenchDestinationAnchor(content, destination.follow, getFrame);
  if (!anchor) return destination.view;
  return { ...destination.view, left: destination.view.left + anchor.left - destination.follow.origin.left,
    top: destination.view.top + anchor.top - destination.follow.origin.top };
}

export function validWorkbenchIndex(index, content, published = false) {
  if (!exact(index, ['open', 'pinned', 'window', 'destinations', 'landingId'])
    || typeof index.open !== 'boolean' || typeof index.pinned !== 'boolean'
    || !validWorkbenchViewRegion(index.window) || index.window.width < 240 || index.window.width > 1200
    || index.window.height < 180 || index.window.height > 2000
    || !Array.isArray(index.destinations) || index.destinations.length > MAX_WORKBENCH_DESTINATIONS) return false;
  const ids = new Set();
  for (const item of index.destinations) {
    if (!exact(item, ['id', 'name', 'view', ...(published ? [] : ['visibility'])], ['follow'])
      || !/^workbench-view:[A-Za-z0-9_-]{1,80}$/u.test(item.id) || ids.has(item.id)
      || !validWorkbenchGroupName(item.name) || !validWorkbenchViewRegion(item.view)
      || !published && !['PUBLIC', 'PRIVATE'].includes(item.visibility)) return false;
    if (Object.hasOwn(item, 'follow') && (!exact(item.follow, ['groupId', 'anchorId', 'origin'])
      || !/^workbench-group:[A-Za-z0-9_-]{1,80}$/u.test(item.follow.groupId)
      || typeof item.follow.anchorId !== 'string' || !item.follow.anchorId.length || item.follow.anchorId.length > 160
      || !position(item.follow.origin) || published && !workbenchDestinationAnchor(content, item.follow))) return false;
    ids.add(item.id);
  }
  return index.landingId === null || ids.has(index.landingId);
}

export const createWorkbenchIndex = () => ({ open: true, pinned: true,
  window: { left: 24, top: 80, width: 300, height: 440 }, destinations: [], landingId: null });

export function projectWorkbenchIndex(index, publicContent) {
  if (!index) return undefined;
  const destinations = index.destinations.filter(item => item.visibility === 'PUBLIC'
    && (!item.follow || workbenchDestinationAnchor(publicContent, item.follow)))
    .map(({ visibility: _visibility, ...item }) => structuredClone(item));
  // Empty/private-only indexes should not reveal their existence or layout.
  if (!destinations.length) return undefined;
  return { ...structuredClone(index), destinations,
    landingId: destinations.some(item => item.id === index.landingId) ? index.landingId : null };
}

export function restoreWorkbenchIndex(published, current) {
  if (!published) return current ? { ...structuredClone(current), landingId: null, destinations: current.destinations.map(item => ({ ...structuredClone(item), visibility: 'PRIVATE' })) } : undefined;
  const ids = new Set(published.destinations.map(item => item.id));
  const privateItems = (current?.destinations || []).filter(item => !ids.has(item.id)).map(item => ({ ...item, visibility: 'PRIVATE' }));
  const destinations = [...published.destinations.map(item => ({ ...structuredClone(item), visibility: 'PUBLIC' })), ...structuredClone(privateItems)];
  // Never silently discard private bookmarks to make a restoration fit.
  if (destinations.length > MAX_WORKBENCH_DESTINATIONS) throw new Error('Restoring this Index would exceed 32 destinations. Remove a local destination first.');
  return { ...structuredClone(published), destinations };
}
