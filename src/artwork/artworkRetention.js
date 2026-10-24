// Only idle documents occupy this pool. The placement still owns the document;
// leaving its Workbench or changing its source cancels retention immediately.
// This is a count/time bound, not an estimate of third-party GPU allocation.
export const ARTWORK_RETENTION_MS = 30_000;
export const ARTWORK_RETENTION_LIMIT = 4;

export function createArtworkRetention({ limit = ARTWORK_RETENTION_LIMIT, duration = ARTWORK_RETENTION_MS,
  schedule = setTimeout, cancel = clearTimeout } = {}) {
  const idle = new Map();
  return {
    retain(evict) {
      const token = {};
      const remove = () => {
        if (!idle.has(token)) return false;
        cancel(idle.get(token).timer); idle.delete(token); return true;
      };
      const expire = () => { if (remove()) evict(); };
      idle.set(token, { timer: schedule(expire, duration), expire });
      while (idle.size > limit) idle.values().next().value.expire();
      return remove;
    },
  };
}

export const artworkRetention = createArtworkRetention();
