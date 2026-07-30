import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeProfileAssetAttributes } from './mergeProfileAssetAttributes.js';

test('Envio enrichment updates matching traits and appends metadata omitted by another indexer', () => {
  const asset = { id: 'asset', attributes: [
    { key: 'Form Rarity', value: 'Old value', type: 'string' },
    { key: 'Performance Tier', value: 'Strike Unit', type: 'string' }
  ], fieldProvenance: { attributes: { scope: 'tokenId', source: 'Chillwhales' } }, rawMetadata: {} };
  const enriched = mergeProfileAssetAttributes(asset, { id: 'asset', attributes: [
    { key: 'Form Rarity', value: 'Ghost Outline', type: 'string' },
    { key: 'Rank', value: '281', type: 'number' }
  ] });
  assert.deepEqual(enriched.attributes, [
    { key: 'Form Rarity', value: 'Ghost Outline', type: 'string' },
    { key: 'Performance Tier', value: 'Strike Unit', type: 'string' },
    { key: 'Rank', value: '281', type: 'number' }
  ]);
  assert.deepEqual(enriched.fieldProvenance.attributes,
    { scope: 'tokenId', source: 'LSP4MetadataForTokenId (LUKSO Envio Indexer)' });
  assert.equal(enriched.rawMetadata.attributesEnrichedBy, 'LUKSO Envio Indexer');
});

test('empty or mismatched enrichment cannot discard existing metadata', () => {
  const asset = { id: 'asset', attributes: [{ key: 'Signal', value: 'High', type: null }] };
  assert.equal(mergeProfileAssetAttributes(asset, { id: 'other', attributes: [{ key: 'Rank', value: 1 }] }), asset);
  assert.equal(mergeProfileAssetAttributes(asset, { id: 'asset', attributes: [] }), asset);
});
