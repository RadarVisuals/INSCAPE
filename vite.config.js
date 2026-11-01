import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { ownerRuntimeIsolationPlugin } from './scripts/ownerRuntimeIsolation.js';
import { diagnosticsEnvironmentPlugin, productionBuildHygienePlugin } from './scripts/productionBuild.js';
import { productionResponseSecurityHeaders } from './scripts/productionSecurityPolicy.js';
import { excludeUnsupportedWalletConnectorsPlugin } from './scripts/unsupportedWalletConnectors.js';
import { narrowLuksoWalletImportsPlugin } from './scripts/luksoWalletImports.js';
import { artworkDocumentHostPlugin } from './scripts/artworkDocumentHost.js';
import { keeperChatgptPlugin } from './scripts/keeperChatgpt/service.js';
import designMetadata, { designMetadataEnabled } from './scripts/designMetadata.js';

export function resolveReleaseCommit(environment = process.env) {
  const candidate = environment.COMMIT_REF || environment.GITHUB_SHA || environment.VITE_COMMIT_REF || 'development';
  return /^[0-9a-f]{7,40}$/iu.test(candidate) ? candidate.toLowerCase() : 'development';
}

export default defineConfig(({ mode, command }) => {
  const productionEnvironment = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    define: { __INSCAPE_RELEASE_COMMIT__: JSON.stringify(resolveReleaseCommit({ ...process.env, ...productionEnvironment })) },
    plugins: [keeperChatgptPlugin(), artworkDocumentHostPlugin(), diagnosticsEnvironmentPlugin(),
      react({ babel: { plugins: designMetadataEnabled(command, mode) ? [[designMetadata, { root: process.cwd() }]] : [] } }),
      narrowLuksoWalletImportsPlugin(), excludeUnsupportedWalletConnectorsPlugin(),
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
        },
      },
    } },
    // Audit exports and browser runtime artifacts are not application entries.
    cacheDir: mode === 'design-lab' ? 'node_modules/.vite-design-lab' : undefined,
    optimizeDeps: mode === 'design-lab'
      // Scan only the lab entry. Full Editor artboards also need their transitive
      // CommonJS dependencies optimized when those lazy components are opened.
      ? { entries: ['design-lab.html'], include: ['react', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'lucide-react', '@tiptap/react', '@tiptap/starter-kit', '@tiptap/extension-text-style', 'buffer', 'qrcode-generator'] }
      : { entries: ['index.html', 'mini-app-host.html', 'browser-tests/*.html'] },
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
