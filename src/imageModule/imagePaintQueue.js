// One worker for mounted Image sides, never one worker per image. Pending work
// is replaceable and decoded pixels are not cached across Workbench lifetimes.
let worker = null, nextId = 0, running = null;
const clients = new Set(), pending = new Map();
function advance() {
  if (!worker || running || !pending.size) return;
  const [client, job] = pending.entries().next().value;
  pending.delete(client); running = { client, ...job };
  worker.postMessage({ type: 'prepare', id: job.id, ...job.request });
}
export function imagePaintClient() {
  if (!worker) {
    try { worker = new Worker(new URL('./imagePaint.worker.js', import.meta.url), { type: 'module' }); }
    catch { return { prepare() {}, cancel() {}, dispose() {} }; }
    worker.onmessage = ({ data }) => {
      if (running?.id !== data.id) return;
      const job = running; running = null;
      if (clients.has(job.client) && job.client.id === data.id) job.callback(data);
      advance();
    };
    worker.onerror = event => {
      event.preventDefault();
      worker?.terminate(); worker = null; running = null; pending.clear();
    };
  }
  const client = { id: 0 }; clients.add(client);
  const cancel = () => {
    client.id = ++nextId; pending.delete(client);
    if (running?.client === client) worker?.postMessage({ type: 'cancel', id: running.id });
  };
  return {
    prepare(request, callback) {
      cancel(); pending.set(client, { id: client.id, request, callback }); advance();
    },
    cancel,
    dispose() {
      cancel(); clients.delete(client);
      if (!clients.size) { worker?.terminate(); worker = null; running = null; pending.clear(); }
    },
  };
}
