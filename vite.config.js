import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { ownerRuntimeIsolationPlugin } from './scripts/ownerRuntimeIsolation.js';
import { diagnosticsEnvironmentPlugin, productionBuildHygienePlugin } from './scripts/productionBuild.js';
import { productionResponseSecurityHeaders } from './scripts/productionSecurityPolicy.js';
import { excludeUnsupportedWalletConnectorsPlugin } from './scripts/unsupportedWalletConnectors.js';

export function resolveReleaseCommit(environment = process.env) {
  const candidate = environment.COMMIT_REF || environment.GITHUB_SHA || environment.VITE_COMMIT_REF || 'development';
  return /^[0-9a-f]{7,40}$/iu.test(candidate) ? candidate.toLowerCase() : 'development';
}

export default defineConfig(({ mode }) => {
  const productionEnvironment = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    define: { __INSCAPE_RELEASE_COMMIT__: JSON.stringify(resolveReleaseCommit({ ...process.env, ...productionEnvironment })) },
    plugins: [diagnosticsEnvironmentPlugin(), react(), excludeUnsupportedWalletConnectorsPlugin(),
      ownerRuntimeIsolationPlugin(), productionBuildHygienePlugin()],
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
