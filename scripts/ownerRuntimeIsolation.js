export const OWNER_RUNTIME_MODULES = [
  '/src/public/OwnerSystemWorkflowShell.jsx',
  '/src/library/state/useLibraryStore.js',
  '/src/signals/state/useSignalStore.js',
  '/src/reception/ReceptionEditor.jsx'
];
export const STANDALONE_WALLET_SOURCE = 'src/wallet/standaloneWalletSession.js';
const normalize = (id) => id.replaceAll('\\', '/');

export function createOwnerRuntimeGraph(bundle) {
  const chunks = Object.fromEntries(Object.entries(bundle).filter(([, output]) => output.type === 'chunk'));
  const ownerChunks = Object.values(chunks).filter((chunk) => Object.keys(chunk.modules)
    .some((id) => OWNER_RUNTIME_MODULES.some((ownerModule) => normalize(id).endsWith(ownerModule))));
  // Rollup can merge this dynamic module into another chunk and choose that
  // module's name. Source membership, rather than a generated name, identifies
  // the wallet boundary for production measurement and browser verification.
  const walletChunks = Object.values(chunks).filter((chunk) => Object.keys(chunk.modules)
    .some((id) => normalize(id).endsWith(`/${STANDALONE_WALLET_SOURCE}`)));
  if (walletChunks.length > 1) throw new Error('The production graph contains multiple standalone wallet source chunks');
  const entryChunks = Object.values(chunks).filter((chunk) => chunk.isEntry);
  const readerChunks = Object.values(chunks).filter(chunk => Object.keys(chunk.modules).some(id =>
    ['/src/reception/OwnerReception.jsx', '/src/profileDocument/components/ProfileOverview.jsx'].some(path => normalize(id).endsWith(path))));
  const staticFiles = (entry) => {
    const visited = new Set();
    const visit = (fileName) => {
      if (visited.has(fileName)) return;
      visited.add(fileName);
      chunks[fileName]?.imports.forEach(visit);
    };
    visit(entry.fileName);
    return visited;
  };

  const leaks = [...entryChunks, ...readerChunks].flatMap((entry) => {
    const initialFiles = staticFiles(entry);
    return ownerChunks.filter((chunk) => initialFiles.has(chunk.fileName))
      .map((chunk) => ({ entry: entry.fileName, ownerChunk: chunk.fileName }));
  });
  return {
    ownerModules: OWNER_RUNTIME_MODULES,
    mobileWalletFiles: Object.values(chunks).filter(chunk => Object.keys(chunk.modules).some(id =>
      /\/node_modules\/@walletconnect\/(ethereum-provider|sign-client)\//u.test(normalize(id)))).map(chunk => chunk.fileName),
    standaloneWallet: walletChunks.length === 1
      ? { source: STANDALONE_WALLET_SOURCE, file: walletChunks[0].fileName }
      : null,
    entries: entryChunks.map((entry) => ({
      file: entry.fileName,
      bytes: Buffer.byteLength(entry.code),
      staticImports: [...staticFiles(entry)].filter((file) => file !== entry.fileName)
    })),
    ownerChunks: ownerChunks.map((chunk) => ({
      file: chunk.fileName,
      bytes: Buffer.byteLength(chunk.code),
      modules: Object.keys(chunk.modules).map(normalize)
        .filter((id) => OWNER_RUNTIME_MODULES.some((ownerModule) => id.endsWith(ownerModule)))
    })),
    leaks
  };
}

export function assertOwnerRuntimeGraph(graph) {
  if (!graph.ownerChunks.length) throw new Error('The production graph did not contain an owner runtime chunk');
  if (graph.leaks.length) {
    throw new Error(`Owner runtime leaked into an initial entry or Reception reader: ${graph.leaks
      .map(({ entry, ownerChunk }) => `${entry} -> ${ownerChunk}`).join(', ')}`);
  }
  if (graph.standaloneWallet?.source !== STANDALONE_WALLET_SOURCE || !graph.standaloneWallet.file) {
    throw new Error('The production graph is missing the standalone wallet source chunk');
  }
  const walletLeaks = graph.entries.filter((entry) => entry.file === graph.standaloneWallet.file
    || entry.staticImports?.includes(graph.standaloneWallet.file));
  if (walletLeaks.length) {
    throw new Error(`Standalone wallet runtime leaked into an initial entry: ${walletLeaks
      .map((entry) => `${entry.file} -> ${graph.standaloneWallet.file}`).join(', ')}`);
  }
}

export function ownerRuntimeIsolationPlugin() {
  return {
    name: 'assert-owner-runtime-isolation',
    apply: 'build',
    generateBundle(_options, bundle) {
      const graph = createOwnerRuntimeGraph(bundle);
      assertOwnerRuntimeGraph(graph);
      this.emitFile({ type: 'asset', fileName: 'owner-runtime-graph.json', source: JSON.stringify(graph, null, 2) });
    }
  };
}
