import { readFile, mkdir, copyFile, writeFile, realpath, lstat } from 'node:fs/promises';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { ARTWORK_DOCUMENT_HTML } from './artworkDocumentHost.js';
import { checkInventory } from './designSystemInventory.js';

const root = fileURLToPath(new URL('../', import.meta.url));

// Only the dedicated generated directory (or a declared static Site dist) may be replaced.
export async function validateOutputDirectory(directory) {
  const output = resolve(directory);
  const defaultOutput = resolve(root, 'dist-design-system');
  if (output !== defaultOutput) {
    const manifest = JSON.parse(
      await readFile(join(dirname(output), '.openai/hosting.json'), 'utf8'),
    );
    if (
      basename(output) !== 'dist' ||
      manifest.static?.directory !== 'dist' ||
      !manifest.project_id
    ) {
      throw new Error('External output must be the dist directory of a declared static Site.');
    }
  }
  const parent = await realpath(dirname(output));
  try {
    const stat = await lstat(output);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      (await realpath(output)).toLowerCase() !== join(parent, basename(output)).toLowerCase()
    ) {
      throw new Error('Refusing to replace an indirect or non-directory output.');
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return output;
}

export async function buildDesignSystem(directory = join(root, 'dist-design-system')) {
  const outDir = await validateOutputDirectory(directory);
  await checkInventory();
  const publicAssets = new Set();
  const exportPlugin = {
    name: 'design-system-visual-export',
    // Inspect asset references without rewriting application source. Vite handles source selection.
    transform(code, id) {
      if (id.includes('/node_modules/') || id.includes('?raw')) return;
      for (const match of code.matchAll(
        /(?:["'`(])\/?(assets\/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+)(?=["'`)\s])/g,
      ))
        publicAssets.add(match[1]);
    },
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        if (
          chunk.moduleIds.some(
            (id) =>
              /[?&]raw\b/.test(id) ||
              id.replaceAll('\\', '/').endsWith('/referenceLinks.local.jsx'),
          )
        ) {
          throw new Error('Raw source or local reference links entered the visual export.');
        }
      }
    },
  };
  await build({
    root,
    configFile: false,
    envDir: false,
    publicDir: false,
    define: { __INSCAPE_RELEASE_COMMIT__: JSON.stringify('design-system-preview') },
    resolve: {
      alias: [
        {
          find: './referenceLinks.local.jsx',
          replacement: join(root, 'design-system/referenceLinks.hosted.jsx'),
        },
      ],
    },
    plugins: [exportPlugin, react()],
    build: {
      outDir,
      emptyOutDir: true,
      sourcemap: false,
      rollupOptions: {
        input: {
          designSystem: join(root, 'design-system.html'),
          tools: join(root, 'browser-tests/tool-chrome-fixture.html'),
          toolbar: join(root, 'browser-tests/workbench-toolbar-fixture.html'),
        },
        output: {
          onlyExplicitManualChunks: true,
          manualChunks: (id) =>
            id.replaceAll('\\', '/').includes('/node_modules/lucide-react/')
              ? 'interface-icons'
              : undefined,
        },
      },
    },
  });
  const copiedAssets = [];
  for (const asset of [...publicAssets].sort()) {
    const source = join(root, 'public', asset);
    try {
      await lstat(source);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    const destination = join(outDir, asset);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
    copiedAssets.push(asset);
  }
  await mkdir(join(outDir, 'design-system'), { recursive: true });
  await copyFile(
    join(root, 'design-system/tokens.generated.json'),
    join(outDir, 'design-system/tokens.generated.json'),
  );
  await copyFile(join(outDir, 'design-system.html'), join(outDir, 'index.html'));
  await mkdir(join(outDir, '.netlify/functions/artwork-document'), { recursive: true });
  await writeFile(
    join(outDir, '.netlify/functions/artwork-document/index.html'),
    ARTWORK_DOCUMENT_HTML,
  );
  // A machine-readable scope record makes the exported payload reviewable.
  await writeFile(
    join(outDir, 'preview-manifest.json'),
    JSON.stringify(
      {
        kind: 'inscape-design-system-visual-preview',
        entrypoints: [
          '/design-system.html',
          '/browser-tests/tool-chrome-fixture.html',
          '/browser-tests/workbench-toolbar-fixture.html',
        ],
        sourceViewer: false,
        internalDocuments: false,
        persistence: false,
        publicAssets: copiedAssets,
      },
      null,
      2,
    ) + '\n',
  );
  console.log('Design-system visual export:', outDir);
  return outDir;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--out-dir'))
      throw new Error('Usage: npm run design-system:build -- [--out-dir <static-site-dist>]');
    await buildDesignSystem(args[1]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
