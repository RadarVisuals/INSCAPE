export const OWNER_RUNTIME_MODULES = [
  '/src/public/ModuleGridShell.jsx',
  '/src/library/state/useLibraryStore.js',
  '/src/signals/state/useSignalStore.js'
];

const normalize = (id) => id.replaceAll('\\', '/');

export function createOwnerRuntimeGraph(bundle) {
  const chunks = Object.fromEntries(Object.entries(bundle).filter(([, output]) => output.type === 'chunk'));
  const ownerChunks = Object.values(chunks).filter((chunk) => Object.keys(chunk.modules)
    .some((id) => OWNER_RUNTIME_MODULES.some((ownerModule) => normalize(id).endsWith(ownerModule))));
  const entryChunks = Object.values(chunks).filter((chunk) => chunk.isEntry);
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

  const leaks = entryChunks.flatMap((entry) => {
    const initialFiles = staticFiles(entry);
    return ownerChunks.filter((chunk) => initialFiles.has(chunk.fileName))
      .map((chunk) => ({ entry: entry.fileName, ownerChunk: chunk.fileName }));
  });

  return {
    ownerModules: OWNER_RUNTIME_MODULES,
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
    throw new Error(`Owner runtime leaked into an initial entry: ${graph.leaks
      .map(({ entry, ownerChunk }) => `${entry} -> ${ownerChunk}`).join(', ')}`);
  }
}
