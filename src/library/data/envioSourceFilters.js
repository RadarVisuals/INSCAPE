// The same predicates must constrain rows and their pagination counts.
export function envioSourceFilters(query = '', collection = 'all') {
  const term = query.trim();
  const contract = /^0x[\da-f]{40}$/i.test(term) && term.toLowerCase();
  const token = !contract && /^(?:\d{1,78}|0x[\da-f]{1,64})$/i.test(term) && BigInt(term).toString(16);
  const tokenId = token && token.length <= 64 ? '0x' + token.padStart(64, '0') : null;
  const match = { _ilike: '%' + term.replace(/[\\%_]/g, '\\$&') + '%' };
  function filter(assets, contracts, hasToken) {
    const and = [];
    if (term) {
      const or = assets.flatMap(path =>
        ['name', 'lsp4TokenName'].map(field => nest(path, { [field]: match }))
      );
      if (hasToken) or.push({ token: { name: match } });
      if (contract) or.push(...contracts.map(path => nest(path, { _eq: contract })));
      if (hasToken && tokenId) or.push({ token: { tokenId: { _eq: tokenId } } });
      and.push({ _or: or });
    }
    if (collection && collection !== 'all')
      and.push({
        _or: assets.flatMap(path =>
          ['name', 'lsp4TokenName'].map(field => nest(path, { [field]: { _eq: collection } }))
        ),
      });
    return and.length ? { _and: and } : {};
  }
  return {
    hold: filter(['asset', 'baseAsset'], ['asset_id', 'baseAsset_id'], true),
    asset: filter(['asset'], ['asset_id'], false),
    token: filter(['token.asset', 'token.baseAsset'], ['token.asset_id', 'token.baseAsset_id'], true),
  };
}
function nest(path, value) {
  return path.split('.').reduceRight((inner, key) => ({ [key]: inner }), value);
}
