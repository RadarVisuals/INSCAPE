import { RENDER_CONFIG_VERSION } from './renderConfig.defaults.js';

/**
 * Registry entries are keyed by the schema version they accept. A future v6
 * phase can replace v5's null migrateToNext with a pure v5 -> v6 function and
 * add the v6 terminal entry. Versions 1-4 are intentionally unsupported:
 * there are no authored documents requiring legacy recipe compatibility.
 */
export const RENDER_CONFIG_MIGRATIONS = Object.freeze({
  5: Object.freeze({
    version: 5,
    migrateToNext: null
  })
});

export function migrateRenderConfigDocument(document, targetVersion = RENDER_CONFIG_VERSION) {
  let current = document;
  let version = document.schemaVersion;

  while (version < targetVersion) {
    const entry = RENDER_CONFIG_MIGRATIONS[version];
    if (!entry || typeof entry.migrateToNext !== 'function') {
      throw new Error(`No RenderConfig migration is registered for schema v${version} -> v${version + 1}.`);
    }
    current = entry.migrateToNext(current);
    version += 1;
    current = { ...current, schemaVersion: version };
  }

  return current;
}
