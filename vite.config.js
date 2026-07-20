import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertOwnerRuntimeGraph, createOwnerRuntimeGraph } from './scripts/ownerRuntimeIsolation.js';

const UNUSED_PUBLIC_PATHS = [
  'assets/patterns',
  'assets/palettes',
  'assets/manifest.json'
];

function pruneProductionAuthoringAssets() {
  return {
    name: 'prune-production-authoring-assets',
    apply: 'build',
    async closeBundle() {
      const distRoot = resolve('dist');
      const paths = [
        ...UNUSED_PUBLIC_PATHS,
        'assets/actors/abyssal_eye/full multi eye purple.afdesign',
        'assets/actors/skull_reaper/position.afdesign'
      ];
      await Promise.all(paths.map((path) => rm(resolve(distRoot, path), { recursive: true, force: true })));
    }
  };
}

function assertOwnerRuntimeIsolation() {
  return {
    name: 'assert-owner-runtime-isolation',
    apply: 'build',
    generateBundle(_options, bundle) {
      const graph = createOwnerRuntimeGraph(bundle);
      assertOwnerRuntimeGraph(graph);

      this.emitFile({
        type: 'asset',
        fileName: 'owner-runtime-graph.json',
        source: JSON.stringify(graph, null, 2)
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), assertOwnerRuntimeIsolation(), pruneProductionAuthoringAssets()],
  build: { manifest: true },
  server: {
    watch: {
      ignored: [
        '**/.edge-*/**',
        '**/.agents/**',
        '**/codebase_dump.md'
      ]
    }
  }
});
