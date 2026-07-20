import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { ownerRuntimeIsolationPlugin } from './scripts/ownerRuntimeIsolation.js';
import { diagnosticsEnvironmentPlugin, productionBuildHygienePlugin } from './scripts/productionBuild.js';

export default defineConfig({
  plugins: [diagnosticsEnvironmentPlugin(), react(), ownerRuntimeIsolationPlugin(), productionBuildHygienePlugin()],
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
