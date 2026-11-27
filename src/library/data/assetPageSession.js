// A paused inventory owns no deadline and starts no network work. Only next()
// advances its iterator; cancellation also rejects providers that ignore abort.
export function createAssetPageSession(open, { timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const iterator = open(controller.signal);
  let pending = null, complete = false;
  const cancel = () => {
    controller.abort();
    void iterator.return?.().catch(() => {});
  };
  return {
    signal: controller.signal, cancel,
    next() {
      if (pending) return pending;
      if (complete) return Promise.resolve(null);
      pending = (async () => {
        controller.signal.throwIfAborted();
        let timer, abort;
        try {
          const result = await Promise.race([iterator.next(), new Promise((_, reject) => {
            abort = () => reject(controller.signal.reason);
            controller.signal.addEventListener('abort', abort, { once: true });
            timer = setTimeout(() => controller.abort(new Error('Asset page did not respond. Retry to refresh.')), timeoutMs);
          })]);
          controller.signal.throwIfAborted();
          if (result.done) throw new Error('Asset inventory is incomplete. Retry to refresh.');
          complete = result.value.complete === true;
          if (complete) void iterator.return?.().catch(() => {});
          return result.value;
        } finally {
          clearTimeout(timer);
          controller.signal.removeEventListener('abort', abort);
          pending = null;
        }
      })();
      return pending;
    },
  };
}
