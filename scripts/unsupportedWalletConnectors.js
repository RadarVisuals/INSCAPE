const BASE_ACCOUNT_MODULE = '@base-org/account';
const VIRTUAL_BASE_ACCOUNT_MODULE = '\0inscape-unsupported-base-account';

export function excludeUnsupportedWalletConnectorsPlugin() {
  return {
    name: 'inscape-exclude-unsupported-wallet-connectors',
    apply: 'build',
    enforce: 'pre',
    resolveId(source) {
      return source === BASE_ACCOUNT_MODULE ? VIRTUAL_BASE_ACCOUNT_MODULE : null;
    },
    load(id) {
      if (id !== VIRTUAL_BASE_ACCOUNT_MODULE) return null;
      return `export function createBaseAccountSDK() {
        throw new Error('Base Account connector is not supported by INSCAPE');
      }`;
    }
  };
}

export const UNSUPPORTED_WALLET_CONNECTOR_MODULES = Object.freeze([BASE_ACCOUNT_MODULE]);
