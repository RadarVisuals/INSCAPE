import { envioSourceFilters } from '../src/library/data/envioSourceFilters.js';
import { LUKSO_INDEXER_URL } from '../src/library/config.js';

// limit:0 asks Hasura to validate each predicate without enumerating a profile.
const query = `query CheckSourceFilters($hold:Hold_bool_exp!, $asset:AssetCreators_bool_exp!, $token:TokenCreators_bool_exp!) {
  Hold(where:$hold,limit:0){id}
  AssetCreators(where:$asset,limit:0){id}
  TokenCreators(where:$token,limit:0){id}
}`;
for (const [kind, term, collection] of [
  ['name', 'Probe', 'all'],
  ['collection', '', 'Probe'],
  ['contract', '0x' + '1'.repeat(40), 'all'],
  ['token', '123', 'all'],
]) {
  try {
    const response = await fetch(process.env.VITE_LUKSO_INDEXER_URL || LUKSO_INDEXER_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables: envioSourceFilters(term, collection) }),
    });
    const result = await response.json();
    if (!response.ok || result.errors || !result.data)
      throw Error(JSON.stringify(result.errors || response.status));
    console.log(kind + ' filters accepted on Hold, AssetCreators and TokenCreators');
  } catch (error) {
    console.error(kind, error.cause?.code || error.message);
    process.exitCode = 1;
  }
}
