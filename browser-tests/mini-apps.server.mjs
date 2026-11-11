import { createServer, loadConfigFromFile } from 'vite';
const { config } = await loadConfigFromFile({ command: 'serve', mode: 'development' });
// Load the project config first: Vite's config merge otherwise discards a null
// watch override. This repeatable test server does not watch archived workspace
// assets, or share the interactive development server's dependency cache.
const server = await createServer({ ...config, configFile: false,
  cacheDir: 'output/mini-apps/vite-cache',
  optimizeDeps: { entries: ['index.html', 'mini-app-host.html'] },
  server: { ...config.server, watch: null, host: '127.0.0.1', port: 5192, strictPort: true } });
await server.listen(); server.printUrls();
