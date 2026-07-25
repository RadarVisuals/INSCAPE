import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProfileDocumentV3 } from '../domain/profileDocumentBuilder.js';
import { uploadProfileDocument } from './profileDocumentUploadClient.js';

const PROFILE = '0x1111111111111111111111111111111111111111';
const CID = 'QmYwAPJzv5CZsnAzt8auVZRnGi2CWF7rP3pVYdWrJwEmQw';
const document = buildProfileDocumentV3({
  profileAddress: PROFILE,
  workspace: { version: 3, profileAddress: PROFILE, favorites: [], folders: [], canvas: { launchers: [], objects: [] } },
  assets: [], publicPresentation: { keeperId: 'abyssal_eye', stageId: 'black' },
  signalSettings: {}, profileIdentity: { name: 'Upload client test' }, createdAt: 1, exportedAt: 2
});

test('upload client sends canonical bytes and validates the returned CID', async () => {
  let request;
  const result = await uploadProfileDocument(document, { fetchImpl: async (url, init) => {
    request = { url, init };
    return Response.json({ cid: CID }, { status: 201 });
  } });
  assert.equal(request.url, '/api/profile-publications');
  assert.equal(request.init.headers['content-type'], 'application/json');
  assert.equal(request.init.body, result.artifact.text);
  assert.equal(result.cid, CID);
  assert.equal(result.ipfsUri, `ipfs://${CID}`);
});

test('upload client does not accept a successful response without a valid CID', async () => {
  await assert.rejects(() => uploadProfileDocument(document, { fetchImpl: async () => Response.json({ cid: 'bad' }, { status: 201 }) }), /invalid IPFS CID/i);
});

