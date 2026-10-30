import { writeFile } from 'node:fs/promises';
import { nomadExport } from './fixtures/nomad-exports.mjs';
for (const variant of (process.env.INSCAPE_EXPORT_VARIANTS || 'full,half,quarter,vector,loop').split(',')) {
  const source = await nomadExport(variant, { probe: false });
  const script = source.match(/<script[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/script>/)?.[1];
  new Function(script);
  if (source.length > 8 * 1024 * 1024) throw new Error('Artwork exceeds host source limit: ' + variant);
  await writeFile(`output/nomad-export-study-2026-10-21/NOMAD-${variant}.svg`, source);
  console.log(variant, Buffer.byteLength(source));
}
