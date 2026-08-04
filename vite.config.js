import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { ownerRuntimeIsolationPlugin } from './scripts/ownerRuntimeIsolation.js';
import { diagnosticsEnvironmentPlugin, productionBuildHygienePlugin } from './scripts/productionBuild.js';
import { productionResponseSecurityHeaders } from './scripts/productionSecurityPolicy.js';

export default defineConfig(({ mode }) => {
  const productionEnvironment = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [diagnosticsEnvironmentPlugin(), react(), ownerRuntimeIsolationPlugin(), productionBuildHygienePlugin()],
    build: { manifest: true },
    preview: { headers: productionResponseSecurityHeaders(productionEnvironment) },
    server: {
      watch: {
        ignored: [
          '**/.edge-*/**',
          '**/.agents/**',
          '**/codebase_dump.md'
        ]
      }
    }
  };
});
