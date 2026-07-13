import { testImageAsset } from './AssetResolver.js';

const MANIFEST_PATH = '/assets/manifest.json';

export class CreatorAssetResolver {
  static manifestPromise = null;

  static async loadManifest() {
    if (!this.manifestPromise) {
      this.manifestPromise = fetch(MANIFEST_PATH).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Creator manifest request failed (${response.status})`);
        }

        const manifest = await response.json();
        for (const key of ['characters', 'patterns', 'palettes']) {
          if (!Array.isArray(manifest[key]) || manifest[key].length === 0) {
            throw new Error(`Creator manifest requires a non-empty "${key}" array`);
          }
        }
        return manifest;
      }).catch((error) => {
        this.manifestPromise = null;
        throw error;
      });
    }

    return this.manifestPromise;
  }

  static selectListedId(requestedId, availableIds, assetType) {
    if (availableIds.includes(requestedId)) return requestedId;

    const fallbackId = availableIds[0];
    console.warn(
      `[CreatorAssetResolver] Unknown ${assetType} "${requestedId}"; using manifest entry "${fallbackId}".`
    );
    return fallbackId;
  }

  static async resolve(config) {
    const manifest = await this.loadManifest();
    const characterId = this.selectListedId(
      config.creatorCharacterId,
      manifest.characters,
      'character'
    );
    const patternId = this.selectListedId(
      config.creatorPatternId,
      manifest.patterns,
      'pattern'
    );
    const paletteId = this.selectListedId(
      config.creatorPaletteId,
      manifest.palettes,
      'palette'
    );

    const keys = {
      char_clipping_mask: `creator_mask_${characterId}`,
      char_lineart: `creator_lineart_${characterId}`,
      char_base: `creator_palette_${paletteId}`,
      creator_pattern: `creator_pattern_${patternId}`
    };

    const paths = {
      mask: `/assets/characters/${characterId}/mask.webp`,
      lineart: `/assets/characters/${characterId}/lineart.webp`,
      base: `/assets/palettes/${paletteId}.webp`,
      pattern: `/assets/patterns/${patternId}.webp`
    };

    const existenceChecks = await Promise.all(
      Object.entries(paths).map(async ([name, src]) => [name, await testImageAsset(src)])
    );
    const availability = Object.fromEntries(existenceChecks);
    const missingAssets = Object.entries(availability)
      .filter(([, exists]) => !exists)
      .map(([name]) => `${name}: ${paths[name]}`);

    if (missingAssets.length > 0) {
      throw new Error(`Creator asset set is incomplete:\n${missingAssets.join('\n')}`);
    }

    const verifiedLoadQueue = [
      { alias: keys.char_clipping_mask, src: paths.mask },
      { alias: keys.char_lineart, src: paths.lineart },
      { alias: keys.char_base, src: paths.base },
      { alias: keys.creator_pattern, src: paths.pattern }
    ];

    return {
      manifest,
      selected: { characterId, patternId, paletteId },
      keys,
      verifiedLoadQueue,
      hasCharClippingMask: true,
      hasLineart: true,
      hasCharBase: true,
      hasEyelids: false,
      discoveredPatterns: [keys.creator_pattern],
      discoveredEyes: [],
      isCreatorRig: true
    };
  }
}
