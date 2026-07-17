import { createFixtureSignal, SIGNAL_DIRECTIONS, SIGNAL_TYPES, sortSignalsNewestFirst } from '../domain/keeperSignal.js';

const FROM = '0x1234567890abcdef1234567890abcdef123489ef';
const TO = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
const ASSET = '0x1111111111111111111111111111111111111111';
const base = 1_735_689_600;
const fixtures = [
  { sourceReference: 'fixture-asset-received', type: SIGNAL_TYPES.ASSET_RECEIVED, direction: SIGNAL_DIRECTIONS.INCOMING, timestamp: base + 600,
    counterparty: FROM, assetContract: ASSET, tokenId: '0x01', amount: '1', assetReference: { id: `42:${ASSET}:0x01`, name: 'ABYSSAL STUDY', standard: 'LSP8', imageUrl: null, metadataStatus: 'partial' } },
  { sourceReference: 'fixture-asset-sent', type: SIGNAL_TYPES.ASSET_SENT, direction: SIGNAL_DIRECTIONS.OUTGOING, timestamp: base + 500,
    counterparty: TO, assetContract: ASSET, tokenId: '0x02', amount: '1', assetReference: { id: `42:${ASSET}:0x02`, name: 'VOID RELIC', standard: 'LSP8', imageUrl: null, metadataStatus: 'partial' } },
  { sourceReference: 'fixture-lyx-received', type: SIGNAL_TYPES.LYX_RECEIVED, direction: SIGNAL_DIRECTIONS.INCOMING, timestamp: base + 400, counterparty: FROM, value: '1250000000000000000' },
  { sourceReference: 'fixture-lyx-sent', type: SIGNAL_TYPES.LYX_SENT, direction: SIGNAL_DIRECTIONS.OUTGOING, timestamp: base + 300, counterparty: TO, value: '500000000000000000' },
  { sourceReference: 'fixture-missing-metadata', type: SIGNAL_TYPES.ASSET_RECEIVED, direction: SIGNAL_DIRECTIONS.INCOMING, timestamp: base + 200,
    counterparty: FROM, assetContract: '0x2222222222222222222222222222222222222222', tokenId: '0x03',
    assetReference: { id: '42:0x2222222222222222222222222222222222222222:0x03', name: 'Unknown asset', standard: 'LSP8', imageUrl: null, metadataStatus: 'unavailable' } }
];

export const fixtureActivityRepository = {
  source: 'FIXTURE',
  async loadRecentActivity(profileAddress) {
    const signals = fixtures.map((entry) => createFixtureSignal(entry, profileAddress));
    signals.push(signals[0]);
    return { signals: sortSignalsNewestFirst(signals), offset: 0, nextOffset: signals.length, complete: true,
      totals: { transfers: 3, lyxReceived: 1 }, partialError: 'Fixture: metadata resolver failed for one asset; normalized activity was retained.' };
  }
};
