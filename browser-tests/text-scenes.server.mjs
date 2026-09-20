import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
const server = await createServer({ configFile: false, plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] }, cacheDir: '.browser-test-runtime/text-scenes-vite',
  optimizeDeps: { entries: [], include: ['react', 'react-dom/client', 'react/jsx-runtime', '@tiptap/react', '@tiptap/core',
    '@tiptap/starter-kit', '@tiptap/extension-text-style', '@tiptap/pm/history', 'viem', 'viem/chains', 'zustand', '@erc725/erc725.js', 'lucide-react', '@lukso/up-provider'] },
  server: { host: '127.0.0.1', port: 5189, strictPort: true, watch: null },
});
await server.listen(); server.printUrls();
