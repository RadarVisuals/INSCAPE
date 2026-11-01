import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeErrorResult } from 'viem';
import { INSCAPE_PROFILE_DOCUMENT_KEY } from '../domain/inscapeProfileDocumentKey.js';
import { describePublicationError, PUBLICATION_ERROR_ABI } from './publicationError.js';

const ADDRESS = '0x1111111111111111111111111111111111111111';

function encoded(errorName, args) {
  return encodeErrorResult({ abi: PUBLICATION_ERROR_ABI, errorName, args });
}

function deeplyNested(data) {
  return { cause: { error: { originalError: { cause: { data: { data } } } } } };
}

test('supported selectors match the official LSP6 and LSP20 signatures', () => {
  const cases = [
    ['NoPermissionsSet', [ADDRESS], '0xf292052a'],
    ['NotAuthorised', [ADDRESS, 'SETDATA'], '0x3bdad6e6'],
    ['NoERC725YDataKeysAllowed', [ADDRESS], '0xed7fa509'],
    ['NotAllowedERC725YDataKey', [ADDRESS, INSCAPE_PROFILE_DOCUMENT_KEY], '0x557ae079'],
    ['InvalidEncodedAllowedERC725YDataKeys', ['0x1234', 'context'], '0xae6cbd37'],
    ['LSP20CallVerificationFailed', [false, '0xdeadbeef'], '0x9d6741e3'],
    ['LSP20CallingVerifierFailed', [false], '0x8c6a8ae3'],
    ['LSP20EOACannotVerifyCall', [ADDRESS], '0x0c392301']
  ];
  for (const [name, args, selector] of cases) assert.equal(encoded(name, args).slice(0, 10), selector, name);
});

test('official LSP6 publication errors decode directly and through Viem-style nested causes', () => {
  const cases = [
    ['NoPermissionsSet', [ADDRESS], `NoPermissionsSet: ${ADDRESS} has no LSP6 permissions`],
    ['NotAuthorised', [ADDRESS, 'SETDATA'], `NotAuthorised: ${ADDRESS} lacks the SETDATA LSP6 permission`],
    ['NoERC725YDataKeysAllowed', [ADDRESS], `NoERC725YDataKeysAllowed: ${ADDRESS} has no allowed ERC725Y data keys`],
    ['NotAllowedERC725YDataKey', [ADDRESS, INSCAPE_PROFILE_DOCUMENT_KEY], `NotAllowedERC725YDataKey: ${ADDRESS} cannot set ${INSCAPE_PROFILE_DOCUMENT_KEY}`],
    ['InvalidEncodedAllowedERC725YDataKeys', ['0x1234', 'while verifying SETDATA'], 'InvalidEncodedAllowedERC725YDataKeys: the LSP6 allowed-data-key configuration is malformed (while verifying SETDATA)']
  ];
  for (const [name, args, expected] of cases) {
    const data = encoded(name, args);
    assert.equal(describePublicationError({ data }), expected, `${name} direct`);
    assert.equal(describePublicationError(deeplyNested(data)), expected, `${name} nested`);
  }
});

test('official LSP20 call-verification errors decode directly and deeply nested', () => {
  const cases = [
    ['LSP20CallVerificationFailed', [false, '0xdeadbeef'], 'LSP20CallVerificationFailed: pre-call verification returned 0xdeadbeef'],
    ['LSP20CallingVerifierFailed', [true], 'LSP20CallingVerifierFailed: the post-call verifier call failed without a reason'],
    ['LSP20EOACannotVerifyCall', [ADDRESS], `LSP20EOACannotVerifyCall: ${ADDRESS} is not a contract verifier`]
  ];
  for (const [name, args, expected] of cases) {
    const data = encoded(name, args);
    assert.equal(describePublicationError({ data }), expected);
    assert.equal(describePublicationError(deeplyNested(data)), expected);
  }
});

test('rejection, timeout, reverted receipt, replacement, and transport failures are distinct', () => {
  assert.equal(describePublicationError({ error: { code: 4001 } }), 'Wallet request rejected by the user');
  assert.equal(describePublicationError({ name: 'WaitForTransactionReceiptTimeoutError', transactionHash: '0xabcdef' }),
    'Timed out waiting for the publication receipt; retry confirmation with the same hash (transaction 0xabcdef)');
  assert.equal(describePublicationError({ receipt: { status: 'reverted' }, transactionHash: '0xabcdef' }),
    'The publication transaction reverted (transaction 0xabcdef)');
  assert.equal(describePublicationError({ replacementReason: 'cancelled', transactionHash: '0xabcdef' }),
    'The submitted transaction was cancelled in the wallet (transaction 0xabcdef)');
  assert.equal(describePublicationError({ replacementReason: 'replaced', transactionHash: '0xabcdef' }),
    'The submitted transaction was replaced by a different transaction (transaction 0xabcdef)');
  assert.equal(describePublicationError({ name: 'HttpRequestError', shortMessage: 'RPC endpoint unavailable' }),
    'Provider/RPC transport failure: RPC endpoint unavailable');
});

test('unknown, malformed, empty, and cyclic errors remain bounded and safe', () => {
  assert.equal(describePublicationError({ data: `0xdeadbeef${'0'.repeat(64)}`, message: 'execution reverted' }),
    'Contract call reverted with unknown selector 0xdeadbeef');
  assert.equal(describePublicationError({ data: `0xcafebabe${'0'.repeat(64)}` }),
    'Contract call reverted with unknown selector 0xcafebabe');
  assert.equal(describePublicationError({ data: '0x', message: 'execution reverted' }),
    'Contract call reverted without decodable error data');
  assert.equal(describePublicationError({ data: 'not hex', message: 'execution reverted' }),
    'Contract call reverted without decodable error data');
  const cyclic = new Error(`provider failed ${`0x${'ab'.repeat(20_000)}`}`); cyclic.cause = cyclic; cyclic.error = cyclic;
  const description = describePublicationError(cyclic);
  assert.ok(description.length <= 320); assert.equal(description.includes('abababababababababab'), false);
  const request = describePublicationError({ shortMessage: 'Provider unavailable', details: `Request Arguments: ${`0x${'cd'.repeat(10_000)}`}` });
  assert.equal(request, 'Provider unavailable');
  assert.equal(describePublicationError(new Error('receipt lookup failed for 0xabcdef1234567890')), 'receipt lookup failed for 0xabcdef1234567890');
  assert.equal(describePublicationError({}), 'Unknown provider failure');
});
