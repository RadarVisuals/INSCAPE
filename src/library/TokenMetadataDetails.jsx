import { useEffect, useState } from 'react';
import { LUKSO_CHAIN_ID } from './config.js';
import { parseCanonicalAssetId } from '../profileDocument/domain/assetReference.js';

function readableToken(id, standard) {
  const identity = standard === 'LSP8' && parseCanonicalAssetId(id);
  return identity?.chainId === LUKSO_CHAIN_ID && /^0x[a-f0-9]{64}$/.test(identity.tokenId) ? identity : null;
}

export default function TokenMetadataDetails({ id, standard, description, traits }) {
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const token = readableToken(id, standard);
  useEffect(() => {
    const identity = readableToken(id, standard);
    if (!identity) return;
    const controller = new AbortController();
    async function read() {
      try {
        const { lsp8CollectionMetadataResolver } = await import('./data/lsp8TokenMetadataResolver.js');
        controller.signal.throwIfAborted();
        const records = await lsp8CollectionMetadataResolver.resolve(identity.contractAddress, [identity], {
          signal: controller.signal, strict: true, refreshContract: true,
        });
        const record = records.get(identity.tokenId);
        if (!record) throw new Error('Token metadata unavailable');
        if (!controller.signal.aborted) setResult({ id, attempt, record });
      } catch {
        if (!controller.signal.aborted) setResult({ id, attempt, failed: true });
      }
    }
    void read();
    return () => controller.abort();
  }, [id, standard, attempt]);
  const current = token && result?.id === id && result.attempt === attempt ? result : null;
  const text = current?.record ? (typeof current.record.description === 'string' ? current.record.description : '') : description;
  const attributes = current?.record ? current.record.attributes.filter(entry => typeof entry.key === 'string' && entry.key.trim()).map(({ key, value }) => ({ label: key, value })) : traits;
  return <>
    {token && !current && <p role="status">Loading token metadata…</p>}
    {current?.failed && <p role="status">Current token metadata unavailable. <button type="button" onClick={() => setAttempt(n => n + 1)}>Retry</button></p>}
    {(text || current?.record || !token) && <section aria-label="Description"><h4>Description</h4><p>{text || 'No description provided.'}</p></section>}
    {attributes?.length > 0 && <section><h4>Attributes</h4><dl aria-label="Traits">
      {attributes.map(({ label, value }, index) => <div key={index}><dt>{label}</dt><dd>{String(value ?? '')}</dd></div>)}
    </dl></section>}
  </>;
}
