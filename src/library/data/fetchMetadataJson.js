export const METADATA_MAX_BYTES = 2 * 1024 * 1024;

// A response-header deadline alone does not bound a stalled response body.
export async function fetchMetadataJson(url, { fetchImpl = fetch, signal, timeoutMs = 10_000,
  maxBytes = METADATA_MAX_BYTES } = {}) {
  const controller = new AbortController(); let timer; let reader;
  const abortError = () => new DOMException('Metadata request aborted', 'AbortError');
  if (signal?.aborted) throw abortError();
  let rejectStopped;
  const stopped = new Promise((_, reject) => { rejectStopped = reject; });
  const stop = (error) => {
    controller.abort(); reader?.cancel().catch(() => {}); rejectStopped(error);
  };
  const abort = () => stop(abortError());
  signal?.addEventListener('abort', abort, { once: true });
  timer = setTimeout(() => stop(Object.assign(new Error('Metadata response timed out'), { code: 'METADATA_TIMEOUT' })), timeoutMs);
  const read = async () => {
    const response = await fetchImpl(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (controller.signal.aborted) { response.body?.cancel().catch(() => {}); throw abortError(); }
    if (!response.ok) { response.body?.cancel().catch(() => {}); throw new Error(`ASSET METADATA RESPONDED ${response.status}`); }
    const oversized = () => Object.assign(new Error('Metadata response is too large'), { code: 'METADATA_TOO_LARGE' });
    if (Number(response.headers?.get('content-length')) > maxBytes) {
      response.body?.cancel().catch(() => {}); throw oversized();
    }
    if (!response.body?.getReader) throw new Error('Metadata response is not stream-readable');
    reader = response.body.getReader();
    const chunks = []; let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (controller.signal.aborted) throw abortError();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { reader.cancel().catch(() => {}); throw oversized(); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  };
  try { return await Promise.race([read(), stopped]); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); reader?.releaseLock(); }
}
