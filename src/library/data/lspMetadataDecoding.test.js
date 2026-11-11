import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeMetadataPointer, decodeStoredNumber, decodeTokenIdForMetadata } from './lspMetadataDecoding.js';

test('shared token ID decoding preserves the URI suffix for every LSP8 format', () => {
  const numeric = `0x${'0'.repeat(62)}2a`;
  const text = `0x${Buffer.from('artwork').toString('hex').padEnd(64, '0')}`;
  const address = '0x1234567890abcdef1234567890abcdef12345678';
  const bytes = `0x1234${'0'.repeat(60)}`;
  assert.equal(decodeTokenIdForMetadata(numeric, 0), '42');
  assert.equal(decodeTokenIdForMetadata(text, 1), 'artwork');
  assert.equal(decodeTokenIdForMetadata(`0x${'0'.repeat(24)}${address.slice(2)}`, 2), address);
  assert.equal(decodeTokenIdForMetadata(bytes, 3), '0x1234');
  for (const format of [4, null, 99]) assert.equal(decodeTokenIdForMetadata(bytes, format), bytes);
});

test('malformed LSP data remains unknown instead of becoming a usable metadata suffix', () => {
  for (const value of [null, '', '0x', '0x01', '0xzz', 42]) assert.equal(decodeTokenIdForMetadata(value, 0), null);
  for (const value of [null, '', '0x', '0xzz', 42, `0x${'f'.repeat(65)}`]) assert.equal(decodeStoredNumber(value), null);
  assert.equal(decodeStoredNumber('0x64'), 100);
  for (const value of [null, '', '0x', '0x1234']) assert.equal(decodeMetadataPointer(value), null);
});
