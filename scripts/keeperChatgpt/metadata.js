import { randomBytes } from 'node:crypto';
import { keeperMetadataResult } from '../../src/keeper/keeperMetadata.js';

export const isMetadataCall = item => item?.type === 'function_call'
  && (item.name === 'read_metadata' && item.namespace === 'keeper' || item.name === 'keeper.read_metadata' && !item.namespace);

export function keeperMetadataTool(scene) {
  const ids = scene?.artworks.filter(item => item.metadata).map(item => item.id) || [];
  return ids.length ? { type: 'function', name: 'read_metadata', strict: true,
    description: 'Read public LSP8 token metadata for up to two supplied artworks when the person asks about metadata, description or traits. Use once, then respond using the result. Does not read wallets, files or ownership.',
    parameters: { type: 'object', additionalProperties: false, properties: {
      targets: { type: 'array', minItems: 1, maxItems: 2, items: { type: 'string', enum: ids } },
    }, required: ['targets'] },
  } : null;
}

export function validateMetadataCall(item, scene) {
  let args; try { args = JSON.parse(item.arguments); } catch { /* Reject below. */ }
  if (!isMetadataCall(item) || typeof item.call_id !== 'string' || !item.call_id || item.call_id.length > 200
    || !args || Object.keys(args).length !== 1 || !Array.isArray(args.targets) || args.targets.length < 1 || args.targets.length > 2
    || new Set(args.targets).size !== args.targets.length || args.targets.some(id => !scene?.artworks.some(art => art.id === id && art.metadata)))
    throw new Error('Keeper requested unavailable artwork metadata.');
  return args.targets;
}

// Browser reads through the existing Library boundary. A one-use, scoped ticket
// returns only the requested projection; no URLs/credentials/reasoning cross it.
export function requestKeeperMetadata(connection, targets, scene, signal, emit, timeoutMs = 35_000) {
  return new Promise((resolve, reject) => {
    const requestId = randomBytes(24).toString('base64url');
    let timer;
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); if (connection.lookup === pending) connection.lookup = null; };
    const abort = () => { cleanup(); reject(signal.reason || new DOMException('Stopped', 'AbortError')); };
    const pending = { requestId, accept(values) {
      if (!Array.isArray(values) || values.length !== targets.length) throw new Error('Invalid metadata results.');
      const results = targets.map((id, index) => {
        if (values[index]?.id !== id) throw new Error('Metadata target changed.');
        return { id, ...keeperMetadataResult(values[index], scene.artworks.find(art => art.id === id).metadata) };
      });
      cleanup(); resolve(results);
    } };
    connection.lookup = pending;
    signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => {
      cleanup(); resolve(targets.map(id => ({ id, status: 'failed', reason: 'Metadata read timed out.' })));
    }, timeoutMs);
    if (signal.aborted) { abort(); return; }
    try { emit({ metadata: { requestId, targets } }); } catch (error) { cleanup(); reject(error); }
  });
}
