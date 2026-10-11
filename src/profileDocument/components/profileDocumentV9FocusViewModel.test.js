import assert from 'node:assert/strict';
import test from 'node:test';
import { createProfileDocumentV9AssetResolver } from '../domain/profileDocumentV9Asset.js';
import { createProfileDocumentV9FocusViewModel } from './profileDocumentV9FocusViewModel.js';

test('shared visitor Metadata retains every published creator and its source scope without rewriting the asset', () => {
  const contractAddress = '0x3333333333333333333333333333333333333333';
  const id = `42:${contractAddress}:0x01`;
  const asset = createProfileDocumentV9AssetResolver([{ id, chainId: 42, contractAddress, tokenId: '0x01',
    standard: 'LSP8', name: 'Lunar study', description: 'A layered landscape', collectionName: 'Lunar Desert',
    imageUrl: 'https://assets.example/lunar.png', imageWidth: 1600, imageHeight: 900, creators: [], attributes: [] }])(id);
  asset.creators = [
    { address: '0x1111111111111111111111111111111111111111', name: 'First artist', source: 'LSP4Creators[]', scope: 'contract' },
    { address: '0x2222222222222222222222222222222222222222', name: 'Second artist', source: 'LSP4Creators[]', scope: 'tokenId' },
  ];
  const bytes = JSON.stringify(asset);
  const model = createProfileDocumentV9FocusViewModel({ id: 'placement:1', asset });
  assert.deepEqual(model.dossier.creators, asset.creators);
  assert.equal(model.dossier.collection, 'Lunar Desert');
  assert.equal(model.dossier.description, 'A layered landscape');
  assert.equal(model.dossier.assetDetailHref, `https://explorer.lukso.network/address/${contractAddress}`);
  assert.deepEqual(model.dossier.technical.filter(entry => entry.provenance).map(entry => entry.provenance),
    ['LSP4Creators[] / contract', 'LSP4Creators[] / tokenId']);
  assert.equal(JSON.stringify(asset), bytes);
});
