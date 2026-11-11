import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { resolve, sep } from 'node:path';
import { keccak256 } from 'viem';

const workspace = resolve('.');
const recoveryDirectory = resolve('public/recovery');
const metadataDirectory = resolve(recoveryDirectory, 'json');
const imageDirectory = resolve(recoveryDirectory, 'images');
const collectionCid = 'Qmf9ixxmB4sSJTbRQVJSq7vKy2UoReShM8GcuBvBCBZGsc';

if (!`${imageDirectory}${sep}`.startsWith(`${workspace}${sep}`)) {
  throw new Error(`Refusing to write outside the workspace: ${imageDirectory}`);
}

mkdirSync(imageDirectory, { recursive: true });

function readWebpDimensions(bytes) {
  if (
    bytes.length < 30 ||
    bytes.toString('ascii', 0, 4) !== 'RIFF' ||
    bytes.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    throw new Error('Not a valid WebP container');
  }

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkType = bytes.toString('ascii', offset, offset + 4);
    const chunkSize = bytes.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;

    if (chunkType === 'VP8X' && chunkSize >= 10) {
      return {
        width: 1 + bytes.readUIntLE(dataOffset + 4, 3),
        height: 1 + bytes.readUIntLE(dataOffset + 7, 3),
      };
    }

    if (chunkType === 'VP8 ' && chunkSize >= 10) {
      return {
        width: bytes.readUInt16LE(dataOffset + 6) & 0x3fff,
        height: bytes.readUInt16LE(dataOffset + 8) & 0x3fff,
      };
    }

    if (chunkType === 'VP8L' && chunkSize >= 5 && bytes[dataOffset] === 0x2f) {
      return {
        width: 1 + bytes[dataOffset + 1] + ((bytes[dataOffset + 2] & 0x3f) << 8),
        height:
          1 +
          (bytes[dataOffset + 2] >> 6) +
          (bytes[dataOffset + 3] << 2) +
          ((bytes[dataOffset + 4] & 0x0f) << 10),
      };
    }

    offset = dataOffset + chunkSize + (chunkSize & 1);
  }

  throw new Error('WebP dimensions were not found');
}

function getExpectedImage(id) {
  const metadata = JSON.parse(readFileSync(resolve(metadataDirectory, String(id)), 'utf8'));
  const image = metadata.LSP4Metadata.images[0][0];
  return {
    hash: image.verification.data.toLowerCase(),
    width: image.width,
    height: image.height,
  };
}

function verifyImage(bytes, expected) {
  const actualHash = keccak256(bytes).toLowerCase();
  const dimensions = readWebpDimensions(bytes);
  return {
    ...dimensions,
    actualHash,
    hashMatchesMetadata: actualHash === expected.hash,
    dimensionsMatchMetadata:
      dimensions.width === expected.width && dimensions.height === expected.height,
  };
}

async function fetchBytes(url, timeoutMs = 90000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

async function recoverImage(id) {
  const expected = getExpectedImage(id);
  const destination = resolve(imageDirectory, `${id}.webp`);
  const temporary = resolve(imageDirectory, `${id}.webp.part`);

  if (existsSync(destination)) {
    try {
      const bytes = readFileSync(destination);
      const verification = verifyImage(bytes, expected);
      return { id, status: 'verified-existing', bytes: bytes.length, ...verification };
    } catch {
      // Replace only this exact, invalid recovery file after a verified download succeeds.
    }
  }

  const sources = [
    `https://api.universalprofile.cloud/image/${collectionCid}/${id}.webp?method=keccak256(bytes)&data=${expected.hash}`,
    `https://gateway.pinata.cloud/ipfs/${collectionCid}/${id}.webp`,
    `https://ipfs.io/ipfs/${collectionCid}/${id}.webp`,
  ];
  const errors = [];

  for (const source of sources) {
    try {
      const bytes = await fetchBytes(source);
      const verification = verifyImage(bytes, expected);
      writeFileSync(temporary, bytes);
      if (existsSync(destination)) unlinkSync(destination);
      renameSync(temporary, destination);
      return { id, status: 'downloaded', bytes: bytes.length, ...verification };
    } catch (error) {
      errors.push(`${new URL(source).host}: ${error.message}`);
    }
  }

  if (existsSync(temporary)) unlinkSync(temporary);
  throw new Error(errors.join('; '));
}

const queue = Array.from({ length: 100 }, (_, index) => index + 1);
const results = [];
const failures = [];
let nextIndex = 0;

async function worker() {
  while (true) {
    const queueIndex = nextIndex++;
    if (queueIndex >= queue.length) return;
    const id = queue[queueIndex];
    try {
      const result = await recoverImage(id);
      results.push(result);
      console.log(
        `${result.status} ${id}.webp (${result.bytes} bytes, ${result.width}x${result.height}, hash ${result.hashMatchesMetadata ? 'matches' : 'DIFFERS'}, dimensions ${result.dimensionsMatchMetadata ? 'match' : 'DIFFER'})`,
      );
    } catch (error) {
      failures.push({ id, error: error.message });
      console.error(`FAILED ${id}.webp: ${error.message}`);
    }
  }
}

await Promise.all(Array.from({ length: 4 }, () => worker()));

const metadataUpdates = [];
for (const result of results) {
  if (result.hashMatchesMetadata && result.dimensionsMatchMetadata) continue;

  const metadataPath = resolve(metadataDirectory, String(result.id));
  const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
  const image = metadata.LSP4Metadata.images[0][0];
  const changes = {};

  if (!result.hashMatchesMetadata) {
    changes.verificationHash = { from: image.verification.data, to: result.actualHash };
    image.verification.data = result.actualHash;
  }
  if (!result.dimensionsMatchMetadata) {
    changes.dimensions = {
      from: `${image.width}x${image.height}`,
      to: `${result.width}x${result.height}`,
    };
    image.width = result.width;
    image.height = result.height;
  }

  writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  metadataUpdates.push({ id: result.id, changes });
}

const totalBytes = results.reduce((sum, result) => sum + result.bytes, 0);
console.log(
  JSON.stringify(
    {
      verified: results.length,
      downloaded: results.filter((result) => result.status === 'downloaded').length,
      reused: results.filter((result) => result.status === 'verified-existing').length,
      totalBytes,
      dimensionsVerified: results.filter(
        (result) => result.width === 2000 && result.height === 2000,
      ).length,
      metadataHashesMatched: results.filter((result) => result.hashMatchesMetadata).length,
      metadataHashMismatches: results
        .filter((result) => !result.hashMatchesMetadata)
        .map(({ id, actualHash }) => ({ id, actualHash })),
      metadataDimensionMismatches: results
        .filter((result) => !result.dimensionsMatchMetadata)
        .map(({ id, width, height }) => ({ id, width, height })),
      metadataUpdates,
      failures,
    },
    null,
    2,
  ),
);

if (failures.length > 0) process.exitCode = 2;
