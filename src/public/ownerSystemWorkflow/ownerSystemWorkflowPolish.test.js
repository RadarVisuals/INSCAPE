import assert from 'node:assert/strict';
import test from 'node:test';
import { ownerSystemWorkflowActivityDetail } from './useOwnerSystemWorkflowActivity.js';

test('activity prefers resolved profile names and keeps a bounded address fallback', () => {
  const entry = { counterparty: '0x1234567890abcdef1234567890abcdef12345678' };
  assert.equal(ownerSystemWorkflowActivityDetail(entry, { name: 'RADAR VISUALS' }), 'RADAR VISUALS');
  assert.equal(ownerSystemWorkflowActivityDetail(entry), '0x123456…45678');
});
