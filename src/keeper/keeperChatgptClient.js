const base = '/__keeper-chatgpt';
export async function keeperChatgptRequest(action, scope, { signal, ...data } = {}) {
  const get = action === 'status';
  const response = await fetch(`${base}/${action}${get ? `?scope=${encodeURIComponent(scope)}` : ''}`, {
    method: get ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', signal,
    headers: { 'X-Inscape-Keeper': '1', ...(!get && { 'Content-Type': 'application/json' }) },
    ...(!get && { body: JSON.stringify({ scope, ...data }) }),
  });
  if (!response.ok || !response.headers.get('Content-Type')?.includes(action === 'message' ? 'application/x-ndjson' : 'application/json')) {
    let detail; try { detail = (await response.json()).error; } catch { /* A missing local service can return the app's HTML. */ }
    throw new Error(detail || 'The local ChatGPT service is unavailable. Restart Inscape’s development server and retry.');
  }
  return action === 'message' ? response : response.json();
}

export async function readKeeperChatStream(response, onDelta, onMetadata) {
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let buffer = '', completed = false, action = null, metadataRequested = false;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 32_768) throw new Error('The reply could not be read. Try again.');
      let index;
      while ((index = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
        if (!line) continue;
        const event = JSON.parse(line);
        if (event.error) throw new Error(event.error);
        if (event.metadata) {
          if (metadataRequested || completed || !onMetadata || !/^[\w-]{32}$/.test(event.metadata.requestId)
            || !Array.isArray(event.metadata.targets) || event.metadata.targets.length < 1 || event.metadata.targets.length > 2
            || new Set(event.metadata.targets).size !== event.metadata.targets.length || event.metadata.targets.some(id => !/^art-[1-8]$/.test(id)))
            throw new Error('Invalid artwork metadata request.');
          metadataRequested = true;
          await onMetadata(event.metadata);
        }
        if (event.delta) onDelta(event.delta);
        if (event.done) { completed = true; action = event.action || null; }
      }
    }
    if (!completed) throw new Error('The reply was interrupted. Try again.');
    return action;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
