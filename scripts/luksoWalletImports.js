import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const PACKAGE_MARKER = '/node_modules/@lukso/up-modal/';
const PREFIX = '\0inscape-lukso-wallet:';
const VERSION = '0.21.11';

// up-modal passes whole dynamic namespaces through Promise.all and a service.
// These facades expose exactly what that reviewed SDK consumes, so Rollup can
// discard unused exports. They retain the original functions and side effects;
// no installed dependency or connector implementation is replaced.
const EXPORTS = Object.freeze({
  '@wagmi/core': ['createConfig', 'createStorage', 'injected', 'connect', 'disconnect', 'getConnection', 'watchConnection', 'getChainId'],
  '@wagmi/connectors': ['walletConnect'],
  viem: ['createClient', 'http'],
  'viem/chains': ['lukso'],
});
const REVIEWED_MODULES = Object.freeze({
  'dist/chunk-4NQ3FIAB.js': {
    hash: 'ef8eb549d8be14314b8e659397ee0671e16790ffbc88c9760423468d52cbed3e',
    imports: ['@wagmi/core', '@wagmi/connectors', 'viem', 'viem/chains'],
  },
  'dist/chunk-UNZJGZS4.js': {
    hash: 'becd59a670b1ff5627498d913eb9d84738560dc6968c4f4f622135109a430cbc',
    imports: ['@wagmi/core'],
  },
});

export function assertReviewedLuksoWalletModule({ version, file, code }) {
  const reviewed = REVIEWED_MODULES[file];
  const hash = createHash('sha256').update(code.replaceAll('\r\n', '\n')).digest('hex');
  if (version !== VERSION || !reviewed || hash !== reviewed.hash) {
    throw new Error(`LUKSO wallet import review required for @lukso/up-modal@${version} (${file}). `
      + 'Recheck every consumed export and the production wallet flows before updating the review.');
  }
  return reviewed;
}

export function narrowLuksoWalletImportsPlugin() {
  const reviews = new Map();
  const facades = new Map();
  const intercepted = new Set();
  const plugin = {
    name: 'inscape-narrow-lukso-wallet-imports',
    enforce: 'pre',
    config() {
      return { optimizeDeps: { esbuildOptions: { plugins: [{
        name: 'inscape-mobile-wallet-dependency-preparation',
        setup(build) {
          build.onLoad({ filter: /[\\/]@lukso[\\/]up-modal[\\/]dist[\\/]chunk-(4NQ3FIAB|UNZJGZS4)\.js$/ }, async ({ path }) => {
            const result = await plugin.transform(await readFile(path, 'utf8'), path);
            return { contents: result.code, loader: 'js', resolveDir: dirname(path) };
          });
        },
      }] } } };
    },
    async transform(code, id) {
      const path = id.split('?')[0].replaceAll('\\', '/');
      const marker = path.lastIndexOf(PACKAGE_MARKER);
      if (marker < 0) return null;
      const root = path.slice(0, marker + PACKAGE_MARKER.length);
      const file = path.slice(root.length);
      if (!REVIEWED_MODULES[file]) return null;
      const manifest = JSON.parse(await readFile(`${root}package.json`, 'utf8'));
      const original = await readFile(path, 'utf8');
      assertReviewedLuksoWalletModule({ version: manifest.version, file, code: original });
      // Vite dev replaces the trailing source-map directive with whitespace.
      // Validate the installed source, then allow only that loader difference.
      const withoutMap = value => value.replaceAll('\r\n', '\n').replace(/\/\/# sourceMappingURL=[^\n]*/gu, '').trimEnd();
      if (withoutMap(code) !== withoutMap(original)) throw new Error(`Unexpected pre-transform of reviewed wallet SDK: ${file}`);
      code = code.replaceAll('\r\n', '\n');
      const helper = JSON.stringify(fileURLToPath(new URL('../src/wallet/deferredMobileWallet.js', import.meta.url)).replaceAll('\\', '/'));
      if (file === 'dist/chunk-4NQ3FIAB.js') {
        return { code: `import { deferMobileWallet } from ${helper};\n` + code.replace('walletConnect({', 'deferMobileWallet(walletConnect)({'), map: null };
      }
      return { code: `import { connectMobileOnDemand } from ${helper};\n` + code
        .replaceAll('if (!this.hasPrewarmed && changedProperties.has("connectors")', 'if (false && !this.hasPrewarmed && changedProperties.has("connectors")')
        .replace('if (this.device?.isMobile) {\n        if (this.prewarmedDeepLink', 'if (this.device?.isMobile) {\n        return connectMobileOnDemand(this, connector, walletConnectDeepLinkUrl);\n        if (this.prewarmedDeepLink'), map: null };
    },
    buildStart() { reviews.clear(); facades.clear(); intercepted.clear(); },
    async resolveDynamicImport(source, importer) {
      const normalized = importer.replaceAll('\\', '/');
      const marker = normalized.lastIndexOf(PACKAGE_MARKER);
      if (marker < 0) return null;
      const packageRoot = normalized.slice(0, marker + PACKAGE_MARKER.length);
      const file = normalized.slice(packageRoot.length);
      // Nested packages have their own dynamic imports and are not SDK code.
      if (!file.startsWith('dist/')) return null;
      if (!reviews.has(importer)) {
        reviews.set(importer, Promise.all([
          readFile(`${packageRoot}package.json`, 'utf8'), readFile(importer, 'utf8'),
        ]).then(([manifest, code]) => assertReviewedLuksoWalletModule({ version: JSON.parse(manifest).version, file, code })));
      }
      const reviewed = await reviews.get(importer);
      if (typeof source !== 'string' || !reviewed.imports.includes(source)) return null;
      // Connectors are nested under up-modal in the lockfile. Always preserve
      // the dependency resolved from the SDK's importer, not from our app root.
      const resolved = await this.resolve(source, importer, { skipSelf: true });
      if (!resolved || resolved.external) throw new Error(`Cannot resolve reviewed wallet dependency: ${source}`);
      const id = `${PREFIX}${source}`;
      const code = `export { ${EXPORTS[source].join(', ')} } from ${JSON.stringify(resolved.id)};`;
      if (facades.has(id) && facades.get(id) !== code) throw new Error(`Conflicting wallet dependency resolutions: ${source}`);
      facades.set(id, code);
      intercepted.add(`${file}:${source}`);
      return id;
    },
    load(id) { return facades.get(id) ?? null; },
    generateBundle() {
      for (const [file, { imports }] of Object.entries(REVIEWED_MODULES)) {
        for (const source of imports) {
          if (!intercepted.has(`${file}:${source}`)) throw new Error(`Reviewed wallet import was not optimized: ${file}:${source}`);
        }
      }
    },
  };
  return plugin;
}
