const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567';

function decodeBase58(value) {
  let bytes = [0];
  for (const character of value) {
    const digit = BASE58.indexOf(character);
    if (digit < 0) return null;
    let carry = digit;
    for (let index = 0; index < bytes.length; index += 1) {
      carry += bytes[index] * 58; bytes[index] = carry & 255; carry >>= 8;
    }
    while (carry) { bytes.push(carry & 255); carry >>= 8; }
  }
  for (const character of value) { if (character !== '1') break; bytes.push(0); }
  return Uint8Array.from(bytes.reverse());
}

function decodeBase32(value) {
  let bits = 0; let buffer = 0; const bytes = [];
  for (const character of value.toLowerCase()) {
    const digit = BASE32.indexOf(character);
    if (digit < 0) return null;
    buffer = (buffer << 5) | digit; bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((buffer >> bits) & 255); buffer &= (1 << bits) - 1; }
  }
  if (bits && buffer !== 0) return null;
  return Uint8Array.from(bytes);
}

function readVarint(bytes, offset) {
  let value = 0; let shift = 0;
  for (let index = offset; index < bytes.length && shift <= 49; index += 1) {
    const byte = bytes[index]; value += (byte & 127) * (2 ** shift);
    if (!(byte & 128)) return { value, offset: index + 1 };
    shift += 7;
  }
  return null;
}

export function isValidCid(value) {
  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/u.test(value)) {
    const bytes = decodeBase58(value);
    return bytes?.length === 34 && bytes[0] === 0x12 && bytes[1] === 0x20;
  }
  if (!/^[bB][a-zA-Z2-7]+$/u.test(value)) return false;
  const bytes = decodeBase32(value.slice(1));
  const version = bytes && readVarint(bytes, 0);
  const codec = version && readVarint(bytes, version.offset);
  const hashCode = codec && readVarint(bytes, codec.offset);
  const hashLength = hashCode && readVarint(bytes, hashCode.offset);
  return Boolean(version?.value === 1 && codec?.value > 0 && hashCode?.value > 0 && hashLength?.value > 0
    && hashLength.offset + hashLength.value === bytes.length);
}
