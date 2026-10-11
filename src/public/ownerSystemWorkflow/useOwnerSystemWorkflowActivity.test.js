import assert from 'node:assert/strict';
import test from 'node:test';
import { ownerSystemWorkflowActivityTimestamp } from './useOwnerSystemWorkflowActivity.js';
import { createFixtureSignal, SIGNAL_TYPES } from '../../signals/domain/keeperSignal.js';

const PROFILE = '0x1111111111111111111111111111111111111111';

test('owner Activity formats the canonical millisecond instant without multiplying it again', () => {
  const fromSeconds = createFixtureSignal({
    sourceReference: 'seconds',
    timestamp: 1_700_000_000,
    type: SIGNAL_TYPES.UNKNOWN_ACTIVITY,
  }, PROFILE);
  const fromMilliseconds = createFixtureSignal({
    sourceReference: 'milliseconds',
    timestamp: 1_700_000_000_000,
    type: SIGNAL_TYPES.UNKNOWN_ACTIVITY,
  }, PROFILE);
  assert.equal(fromSeconds.timestamp, 1_700_000_000_000);
  assert.equal(fromMilliseconds.timestamp, 1_700_000_000_000);
  assert.deepEqual(ownerSystemWorkflowActivityTimestamp(fromSeconds.timestamp, {
    locales: 'en-GB', timeZone: 'UTC',
  }), { date: '14 Nov 2023', time: '22:13' });
});

test('owner Activity leaves missing or invalid event time explicitly unknown', () => {
  for (const timestamp of [null, undefined, 0, Number.NaN, Number.POSITIVE_INFINITY, 'not-a-time']) {
    assert.deepEqual(ownerSystemWorkflowActivityTimestamp(timestamp), { date: 'UNKNOWN', time: '' });
  }
});
