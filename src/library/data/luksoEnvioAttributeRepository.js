import { LUKSO_CHAIN_ID, LUKSO_INDEXER_URL } from '../config.js';

const TOKEN_ATTRIBUTES_QUERY = `query InscapeTokenAttributes($ids: [String!]!) {
  Token(where: { id: { _in: $ids } }) {
    id tokenId baseAsset_id
    attributes(order_by: { id: asc }) { key value attributeType }
  }
}`;
const PAGE_SIZE = 100;

function parseStableTokenAssetId(stableAssetId) {
  const match = String(stableAssetId || '').match(/^(\d+):(0x[0-9a-f]{40}):(0x[0-9a-f]{1,64})$/iu);
  if (!match || Number(match[1]) !== LUKSO_CHAIN_ID) return null;
  const contractAddress = match[2].toLowerCase();
  const tokenId = match[3].toLowerCase();
  const envioTokenId = `0x${tokenId.slice(2).padStart(64, '0')}`;
  return { stableAssetId: `${LUKSO_CHAIN_ID}:${contractAddress}:${tokenId}`,
    envioId: `${contractAddress}-${envioTokenId}` };
}

function normalizeAttributes(attributes) {
  return (Array.isArray(attributes) ? attributes : []).map((attribute) => ({
    key: String(attribute?.key || '').trim(), value: attribute?.value ?? '', type: attribute?.attributeType || null
  })).filter((attribute) => attribute.key);
}

export function createLuksoEnvioAttributeRepository({ endpoint = LUKSO_INDEXER_URL,
  fetchImpl = globalThis.fetch, pageSize = PAGE_SIZE } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetch is required');
  return {
    source: 'LUKSO Envio Indexer', endpoint,
    async enrich(assetIds, { signal } = {}) {
      const tokens = [...new Map((Array.isArray(assetIds) ? assetIds : []).map(parseStableTokenAssetId)
        .filter(Boolean).map((entry) => [entry.envioId, entry])).values()];
      const enrichments = [];
      for (let offset = 0; offset < tokens.length; offset += pageSize) {
        const page = tokens.slice(offset, offset + pageSize);
        const response = await fetchImpl(endpoint, { method: 'POST', signal,
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ query: TOKEN_ATTRIBUTES_QUERY, variables: { ids: page.map((entry) => entry.envioId) } }) });
        if (!response.ok) throw new Error(`LUKSO indexer responded ${response.status}`);
        const payload = await response.json();
        if (payload.errors?.length) throw new Error(payload.errors.map((entry) => entry.message).join('; '));
        const stableIds = new Map(page.map((entry) => [entry.envioId, entry.stableAssetId]));
        (Array.isArray(payload.data?.Token) ? payload.data.Token : []).forEach((token) => {
          const stableAssetId = stableIds.get(String(token?.id || '').toLowerCase());
          const attributes = normalizeAttributes(token?.attributes);
          if (stableAssetId && attributes.length) enrichments.push({ id: stableAssetId, attributes });
        });
      }
      return enrichments;
    }
  };
}

export const luksoEnvioAttributeRepository = createLuksoEnvioAttributeRepository();
