import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { ownerRuntimeIsolationPlugin } from './scripts/ownerRuntimeIsolation.js';
import { diagnosticsEnvironmentPlugin, productionBuildHygienePlugin } from './scripts/productionBuild.js';
import { productionResponseSecurityHeaders } from './scripts/productionSecurityPolicy.js';
import { excludeUnsupportedWalletConnectorsPlugin } from './scripts/unsupportedWalletConnectors.js';
import { narrowLuksoWalletImportsPlugin } from './scripts/luksoWalletImports.js';
import { artworkDocumentHostPlugin } from './scripts/artworkDocumentHost.js';
import { keeperChatgptPlugin } from './scripts/keeperChatgpt/service.js';

export function resolveReleaseCommit(environment = process.env) {
  const candidate = environment.COMMIT_REF || environment.GITHUB_SHA || environment.VITE_COMMIT_REF || 'development';
  return /^[0-9a-f]{7,40}$/iu.test(candidate) ? candidate.toLowerCase() : 'development';
}

export default defineConfig(({ mode }) => {
  const productionEnvironment = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    define: { __INSCAPE_RELEASE_COMMIT__: JSON.stringify(resolveReleaseCommit({ ...process.env, ...productionEnvironment })) },
    plugins: [keeperChatgptPlugin(), artworkDocumentHostPlugin(), diagnosticsEnvironmentPlugin(), react(), narrowLuksoWalletImportsPlugin(), excludeUnsupportedWalletConnectorsPlugin(),
      ownerRuntimeIsolationPlugin(), productionBuildHygienePlugin()],
    build: { manifest: true, rollupOptions: {
      input: { app: 'index.html', miniAppHost: 'mini-app-host.html' },
      output: {
        // One shared icon family should not become dozens of tiny shared files.
        // Keep module/editor dependencies in their existing lazy boundaries.
        onlyExplicitManualChunks: true,
        // Vite already preloads a lazy route's transitive dependencies. Avoid
        // duplicating those imports again in every Rollup entry facade.
        hoistTransitiveImports: false,
        manualChunks: id => {
          const path = id.replaceAll('\\', '/');
          if (path.includes('/node_modules/lucide-react/')) return 'interface-icons';
          // Both Reception edit entrances load the same editor. Keep their
          // facades together to avoid repeating its large dependency/preload
          // list, while preserving the lazy boundary from both readers.
          if (['OwnerReceptionEditor', 'ReceptionStoreEditor', 'ReceptionEditor']
            .some(name => path.endsWith('/src/reception/' + name + '.jsx'))) return 'reception-editing';
        },
      },
    } },
    // Audit exports and browser runtime artifacts are not application entries.
    optimizeDeps: { entries: ['index.html', 'mini-app-host.html', 'browser-tests/*.html'] },
    preview: { headers: productionResponseSecurityHeaders(productionEnvironment) },
    server: {
      watch: {
        ignored: [
          // Standalone prototypes contain large generated trees outside this app.
          '**/Mobile/**',
          '**/output/**',
          '**/.edge-*/**',
          '**/.browser-test-runtime*/**',
          '**/.browser-test-profile*/**',
          '**/.agents/**',
          '**/codebase_dump.md'
        ]
      }
    }
  };
});
