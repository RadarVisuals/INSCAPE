// One worker and one decoded paint URL per mounted source/resolution. Entries
// are leases, not a persistent media cache: the final consumer releases the URL.
export function createImagePaintQueue({
  createWorker = () => new Worker(new URL('./imagePaint.worker.js', import.meta.url), { type: 'module' }),
  createURL = blob => URL.createObjectURL(blob), revokeURL = url => URL.revokeObjectURL(url),
  decode = async url => { const image = new Image(); image.src = url; await image.decode(); },
} = {}) {
  let worker = null, nextId = 0, running = null;
  const clients = new Set(), entries = new Map(), pending = new Set();
  const remove = entry => {
    if (entries.get(entry.key) === entry) entries.delete(entry.key);
    pending.delete(entry); entry.disposed = true;
    if (running === entry) worker?.postMessage({ type: 'cancel', id: entry.id });
    if (entry.url) { revokeURL(entry.url); entry.url = null; }
  };
  const notify = (entry, result) => {
    for (const client of [...entry.clients]) if (client.entry === entry && clients.has(client)) client.callback(result);
  };
  const fail = entry => {
    remove(entry); notify(entry, { url: null, width: 0, height: 0 });
  };
  const ensureWorker = () => {
    if (worker) return true;
    try { worker = createWorker(); } catch { return false; }
    const instance = worker;
    instance.onmessage = async ({ data }) => {
      if (worker !== instance || running?.id !== data.id) return;
      const entry = running; running = null; advance();
      if (entry.disposed) return;
      if (!data.blob) { fail(entry); return; }
      try {
        entry.url = createURL(data.blob);
        await decode(entry.url);
        if (entry.disposed) return;
        entry.result = { url: entry.url, width: data.width, height: data.height };
        notify(entry, entry.result);
      } catch { if (!entry.disposed) fail(entry); }
    };
    instance.onerror = event => {
      event.preventDefault();
      if (worker !== instance) return;
      instance.terminate(); worker = null;
      const failed = [...pending, ...(running ? [running] : [])];
      running = null; pending.clear();
      for (const entry of failed) fail(entry);
    };
    return true;
  };
  function advance() {
    if (running || !pending.size) return;
    if (!ensureWorker()) { for (const entry of [...pending]) fail(entry); return; }
    running = pending.values().next().value; pending.delete(running);
    worker.postMessage({ type: 'prepare', id: running.id, ...running.request });
  }
  return {
    client() {
      const client = { entry: null, callback: null }; clients.add(client);
      const cancel = () => {
        const entry = client.entry; client.entry = null; client.callback = null;
        if (!entry) return;
        entry.clients.delete(client);
        if (!entry.clients.size) remove(entry);
      };
      return {
        prepare(request, callback) {
          if (!clients.has(client)) return;
          cancel();
          if (!Number.isSafeInteger(request.width) || !Number.isSafeInteger(request.height)
            || request.width <= 0 || request.height <= 0) return;
          const key = JSON.stringify([request.source, request.width, request.height]);
          let entry = entries.get(key);
          // A smaller viewport can reuse already decoded detail. Larger requests
          // never settle for an undersized source; they retain the native image.
          if (!entry) entry = [...entries.values()].filter(item => item.request.source === request.source
            && item.result && item.result.width >= request.width && item.result.height >= request.height)
            .sort((a, b) => a.result.width * a.result.height - b.result.width * b.result.height)[0];
          if (!entry) {
            entry = { key, id: ++nextId, request: { ...request }, clients: new Set(), disposed: false, url: null, result: null };
            entries.set(key, entry); pending.add(entry);
          }
          client.entry = entry; client.callback = callback; entry.clients.add(client);
          if (entry.result) callback(entry.result); else advance();
        },
        cancel,
        dispose() {
          cancel(); clients.delete(client);
          if (!clients.size) {
            worker?.terminate(); worker = null; running = null; pending.clear();
            for (const entry of entries.values()) remove(entry);
          }
        },
      };
    },
  };
}
const shared = createImagePaintQueue();
export const imagePaintClient = () => shared.client();
