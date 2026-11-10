import { createHash } from 'node:crypto';

const reviewedHash = 'de07586c89e2efbba6c59a9900b6419f8e19c6bf8e03f850d5e4d4db68f3e41f';
// Exact XML fragments only: no coordinate rounding or SVG interpretation.
const fragments = [' offset="0"/><stop stop-color="', ' offset="1"/></linearGradient>',
  ' stroke-miterlimit="10" stroke-width="5"', ' gradientUnits="userSpaceOnUse"',
  '<linearGradient id="', ' fill="none" stroke="url(#', '<path class="', '<stop stop-color="',
  '</linearGradient>', '<path d="', '/><path ', ' stop-color="', ' fill="', ' stroke="', ' class="', ' transform="'];

export function packedSvgExpression(svg) {
  if (/[\ue000-\uf8ff]/u.test(svg)) throw Error('Provider artwork contains reserved dictionary characters');
  let packed = svg;
  const dictionary = [];
  for (const fragment of fragments) {
    if (packed.split(fragment).length < 5) continue;
    packed = packed.split(fragment).join(String.fromCharCode(0xe000 + dictionary.length));
    dictionary.push(fragment);
  }
  // The small decoder runs once with module initialization, before the SDK's
  // existing encodeURIComponent call. The resulting SVG is unchanged.
  return `((text, dictionary) => text.replace(/[\\ue000-\\uf8ff]/g, token => dictionary[token.charCodeAt(0) - 57344]))(${JSON.stringify(packed)}, ${JSON.stringify(dictionary)})`;
}

export function compressProviderArtwork(code) {
  if (createHash('sha256').update(code).digest('hex') !== reviewedHash)
    throw Error('Provider artwork review required for the installed @lukso/up-provider index');
  const match = code.match(/var image = `([^`]+)`;/su);
  if (!match || !match[1].startsWith('<?xml') || /\\|\$\{/u.test(match[1]))
    throw Error('Provider artwork declaration no longer matches the reviewed SVG literal');
  return code.replace(match[0], `var image = ${packedSvgExpression(match[1])};`);
}

export function providerArtworkCompressionPlugin() {
  return {
    name: 'inscape-provider-artwork-compression', apply: 'build', enforce: 'pre',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/node_modules/@lukso/up-provider/dist/index.mjs')) return null;
      return { code: compressProviderArtwork(code), map: null };
    },
  };
}
