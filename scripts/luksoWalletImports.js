import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const PACKAGE_MARKER = '/node_modules/@lukso/up-modal/';
const PREFIX = '\0inscape-lukso-wallet:';
const VERSION = '1.0.2';

// up-modal passes whole dynamic namespaces through Promise.all and a service.
// These facades expose exactly what that reviewed SDK consumes, so Rollup can
// discard unused exports. The reviewed transforms defer mobile preparation
// until explicit choice; the SDK retains its connection and approval handling.
const EXPORTS = Object.freeze({
  '@wagmi/core': ['createConfig', 'createStorage', 'injected', 'connect', 'disconnect', 'getConnection', 'watchConnection', 'getChainId'],
  '@wagmi/connectors': ['walletConnect'],
  viem: ['createClient', 'http'],
  'viem/chains': ['lukso'],
});
const REVIEWED_MODULES = Object.freeze({
  'dist/chunk-BZO3BROK.js': {
    hash: '9886112b7ff81cc4193d4f80c1f8abae01a723f5c43d89b567176c5643a7854f',
    imports: ['@wagmi/core', '@wagmi/connectors', 'viem', 'viem/chains'],
  },
  'dist/chunk-DCBIK4FA.js': {
    hash: '9b13a4b86b609f740f6976cd27237badf7ae07f93c17c3e0ff39d788a7ceca25',
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
          build.onLoad({ filter: /[\\/]@lukso[\\/]up-modal[\\/]dist[\\/]chunk-(BZO3BROK|DCBIK4FA)\.js$/ }, async ({ path }) => {
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
      if (file === 'dist/chunk-BZO3BROK.js') {
        return { code: `import { deferMobileWallet } from ${helper};\n` + code.replace('walletConnect({', 'deferMobileWallet(walletConnect)({'), map: null };
      }
      // Remove eager mobile preparation instead of leaving a disabled duplicate.
      // Prepare on selection, then require a fresh tap to launch a ready link.
      const eagerPreparation = '  updated(changedProperties) {\n    super.updated(changedProperties);\n    if (!this.hasPrewarmed && !this._pendingWalletConnect && changedProperties.has("connectors") && this.connectors.length > 0 && this.device?.isMobile) {\n      this.hasPrewarmed = true;\n      this.prewarmWalletConnectUri();\n    }\n  }\n';
      return { code: `import { prepareMobileWalletOnDemand, cancelMobileWalletPreparation } from ${helper};\n` + code
        .replace(eagerPreparation, '')
        .replace('if (this.device?.isMobile) {\n        if (this.prewarmedDeepLink', 'if (this.device?.isMobile) {\n        if (!prepareMobileWalletOnDemand(this)) return;\n        if (this.prewarmedDeepLink')
        .replace('    super.disconnectedCallback();\n    document.removeEventListener("visibilitychange", this._handlePageVisible);', '    super.disconnectedCallback();\n    cancelMobileWalletPreparation(this);\n    document.removeEventListener("visibilitychange", this._handlePageVisible);')
        .replace('this.formatMessage(\n            this.inUpAppBrowser ? "connect_modal_connectors_up_login" : "connect_modal_connectors_up_mobile"\n          )', 'this.device?.isMobile && this.prewarmedDeepLink && !this.inUpAppBrowser ? "Open UP! App" : this.formatMessage(\n            this.inUpAppBrowser ? "connect_modal_connectors_up_login" : "connect_modal_connectors_up_mobile"\n          )'), map: null };
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
