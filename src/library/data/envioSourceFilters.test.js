import assert from 'node:assert/strict';
import test from 'node:test';
import { envioSourceFilters } from './envioSourceFilters.js';

test('search applies literal names to tokens and their collections across relationship tables', () => {
  const filters = envioSourceFilters('a_b%', 'Canvas');
  for (const filter of Object.values(filters)) {
    assert.equal(filter._and.length, 2);
    assert.ok(JSON.stringify(filter).includes(JSON.stringify('%a\\_b\\%%')));
    assert.ok(JSON.stringify(filter).includes('"Canvas"'));
  }
  assert.deepEqual(filters.token._and[1]._or[0], { token: { asset: { name: { _eq: 'Canvas' } } } });
});

test('token numbers use canonical bytes32, addresses use exact contract relationships', () => {
  const id = '0x' + '2a'.padStart(64, '0');
  for (const text of ['42', '0x2A', id]) {
    const { hold, token, asset } = envioSourceFilters(text);
    for (const filter of [hold, token])
      assert.deepEqual(filter._and[0]._or.at(-1), { token: { tokenId: { _eq: id } } });
    assert.ok(!JSON.stringify(asset).includes('tokenId'));
  }
  const address = '0x' + 'Ab'.repeat(20);
  assert.ok(
    envioSourceFilters(address).hold._and[0]._or.some(row => row.baseAsset_id?._eq === address.toLowerCase())
  );
  assert.deepEqual(envioSourceFilters(), { hold: {}, asset: {}, token: {} });
});
