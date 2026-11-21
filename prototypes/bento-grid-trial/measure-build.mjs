import { build } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = resolve(root, '.verification/bento-responsive-build');
const result = await build({ root, configFile: false, publicDir: 'public', build: {
  outDir: output, emptyOutDir: false, copyPublicDir: false, minify: 'terser',
  terserOptions: { maxWorkers: 4, compress: { passes: 2 } },
  rollupOptions: { input: resolve(root, 'prototypes/bento-grid-trial/index.html') },
} });
const resources = result.output.filter(file => /\.(js|css)$/.test(file.fileName)).map(file => {
  const bytes = Buffer.from(file.type === 'chunk' ? file.code : file.source);
  return { file: file.fileName, raw: bytes.length, gzip: gzipSync(bytes).length };
});
const report = { note: 'Prototype-owned JS/CSS only. CDN React, RGL and vendor CSS are external and excluded.', resources };
await writeFile(resolve(output, 'measurement.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
