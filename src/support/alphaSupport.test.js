import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALPHA_SUPPORT_CODES,
  alphaRecoveryGuidance,
  classifyPublicationSupportCode,
  createAlphaSupportEvidence,
  formatAlphaSupportEvidence,
  resolveAlphaRouteClass,
} from './alphaSupport.js';

const PROFILE = `0x${'11'.repeat(20)}`;
const HASH = `0x${'22'.repeat(32)}`;

test('support evidence contains only the bounded allowlist and strips sensitive values', () => {
  const evidence = createAlphaSupportEvidence({
    code: ALPHA_SUPPORT_CODES.CID_VERIFICATION_FAILED,
    phase: 'CID_VERIFY', providerCategory: 'IPFS_GATEWAY', profileAddress: PROFILE,
    transactionHash: HASH, releaseCommit: 'ABCDEF1234567', routeClass: 'OWNER_OR_PROFILE',
    viewportWidth: 1000, userAgent: 'Mozilla/5.0 (private platform) Chrome/140.0.0.0 Safari/537.36 Edg/140.1',
    message: `authorization=secret https://private.example/path 0x${'aa'.repeat(80)}`,
    privateTables: ['must-not-appear'],
  });
  assert.deepEqual(Object.keys(evidence), ['product', 'release', 'route', 'viewport', 'browser', 'code', 'phase', 'provider', 'publicProfile', 'transactionHash']);
  const report = formatAlphaSupportEvidence(evidence);
  assert.doesNotMatch(report, /secret|private\.example|aaaaaa/iu);
  assert.match(report, /release: abcdef1234567/u);
  assert.match(report, /browser: EDGE\/140\.1/u);
  assert.doesNotMatch(report, /private platform|message:/iu);
  assert.match(report, new RegExp(HASH, 'iu'));
});

test('invalid addresses, hashes, codes and unknown fields fail closed', () => {
  const evidence = createAlphaSupportEvidence({ code: 'ARBITRARY', profileAddress: 'bad', transactionHash: '0x12', privateDraft: 'nope', releaseCommit: '' });
  assert.equal(evidence.code, ALPHA_SUPPORT_CODES.UNEXPECTED_APPLICATION_ERROR);
  assert.equal(evidence.publicProfile, undefined);
  assert.equal(evidence.transactionHash, undefined);
  assert.equal(evidence.privateDraft, undefined);
});

test('route classification never retains a full URL or query value', () => {
  assert.equal(resolveAlphaRouteClass({ search: `?view=${PROFILE}&secret=value` }), 'DIRECT_PROFILE');
  assert.equal(resolveAlphaRouteClass({ search: `?profile=${PROFILE}` }), 'OWNER_OR_PROFILE');
  assert.equal(resolveAlphaRouteClass({ search: '?mode=atelier' }), 'PUBLIC_ENTRY');
  assert.equal(resolveAlphaRouteClass({ search: '' }), 'PUBLIC_ENTRY');
});

test('publication support classification reuses bounded publication outcomes', () => {
  assert.equal(classifyPublicationSupportCode({ code: 4001 }), ALPHA_SUPPORT_CODES.WALLET_REJECTED);
  assert.equal(classifyPublicationSupportCode({ code: 'RECEIPT_TIMEOUT' }), ALPHA_SUPPORT_CODES.TRANSACTION_TIMEOUT);
  assert.equal(classifyPublicationSupportCode({ code: 'RECEIPT_REVERTED' }), ALPHA_SUPPORT_CODES.TRANSACTION_REVERTED);
  assert.equal(classifyPublicationSupportCode({ reason: 'replaced' }, 'transaction replaced'), ALPHA_SUPPORT_CODES.TRANSACTION_REPLACED);
  assert.equal(classifyPublicationSupportCode(new Error('resolver mismatch')), ALPHA_SUPPORT_CODES.PUBLICATION_RESOLUTION_FAILED);
});

test('post-hash recovery forbids duplicate publication while pre-hash guidance stays bounded', () => {
  assert.match(alphaRecoveryGuidance(ALPHA_SUPPORT_CODES.TRANSACTION_TIMEOUT, HASH), /Do not submit another/iu);
  assert.match(alphaRecoveryGuidance(ALPHA_SUPPORT_CODES.WALLET_REJECTED), /Nothing was submitted/iu);
  assert.match(alphaRecoveryGuidance(ALPHA_SUPPORT_CODES.PUBLICATION_RESOLUTION_FAILED), /No wallet action or publication transaction is involved/iu);
  assert.doesNotMatch(alphaRecoveryGuidance(ALPHA_SUPPORT_CODES.PUBLICATION_RESOLUTION_FAILED), /ambiguous wallet action/iu);
});
