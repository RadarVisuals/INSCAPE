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
    const pattern1Id = this.selectListedId(
      config.creatorPatternId,
      manifest.patterns,
      'pattern'
    );
    const pattern2Id = this.selectListedId(
      config.creatorPattern2Id,
      manifest.patterns,
      'pattern'
    );
    const paletteSelections = {
      baseA: config.creatorPaletteId,
      baseB: config.creatorBasePaletteBId,
      pattern1A: config.creatorPattern1PaletteAId,
      pattern1B: config.creatorPattern1PaletteBId,
      pattern2A: config.creatorPattern2PaletteAId,
      pattern2B: config.creatorPattern2PaletteBId
    };
    const palettes = Object.fromEntries(Object.entries(paletteSelections).map(([slot, requestedId]) => [
      slot,
      this.selectListedId(requestedId, manifest.palettes, `${slot} palette`)
    ]));
    const paletteId = this.selectListedId(
      config.creatorPaletteId,
      manifest.palettes,
      'palette'
    );

    const keys = {
      char_clipping_mask: `creator_mask_${characterId}`,
      char_lineart: `creator_lineart_${characterId}`,
      char_base: `creator_palette_${paletteId}`,
      creator_pattern: `creator_pattern_${pattern1Id}`,
      creator_pattern_2: `creator_pattern_${pattern2Id}`,
      creator_base_a: `creator_palette_${palettes.baseA}`,
      creator_base_b: `creator_palette_${palettes.baseB}`,
      creator_pattern_1_a: `creator_palette_${palettes.pattern1A}`,
      creator_pattern_1_b: `creator_palette_${palettes.pattern1B}`,
      creator_pattern_2_a: `creator_palette_${palettes.pattern2A}`,
      creator_pattern_2_b: `creator_palette_${palettes.pattern2B}`
    };

    const paths = {
      mask: `/assets/characters/${characterId}/mask.webp`,
      lineart: `/assets/characters/${characterId}/lineart.webp`,
      base: `/assets/palettes/${paletteId}.webp`,
      pattern1: `/assets/patterns/${pattern1Id}.webp`,
      pattern2: `/assets/patterns/${pattern2Id}.webp`,
      baseA: `/assets/palettes/${palettes.baseA}.webp`,
      baseB: `/assets/palettes/${palettes.baseB}.webp`,
      pattern1A: `/assets/palettes/${palettes.pattern1A}.webp`,
      pattern1B: `/assets/palettes/${palettes.pattern1B}.webp`,
      pattern2A: `/assets/palettes/${palettes.pattern2A}.webp`,
      pattern2B: `/assets/palettes/${palettes.pattern2B}.webp`
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

    const requestedLoadQueue = [
      { alias: keys.char_clipping_mask, src: paths.mask },
      { alias: keys.char_lineart, src: paths.lineart },
      { alias: keys.creator_pattern, src: paths.pattern1 },
      { alias: keys.creator_pattern_2, src: paths.pattern2 },
      { alias: keys.creator_base_a, src: paths.baseA },
      { alias: keys.creator_base_b, src: paths.baseB },
      { alias: keys.creator_pattern_1_a, src: paths.pattern1A },
      { alias: keys.creator_pattern_1_b, src: paths.pattern1B },
      { alias: keys.creator_pattern_2_a, src: paths.pattern2A },
      { alias: keys.creator_pattern_2_b, src: paths.pattern2B }
    ];
    // Palette A and B may deliberately point at the same colour. Pixi aliases
    // are unique, so collapse duplicate selections before asking Assets to load.
    const verifiedLoadQueue = Array.from(
      new Map(requestedLoadQueue.map((asset) => [asset.alias, asset])).values()
    );

    return {
      manifest,
      selected: { characterId, pattern1Id, pattern2Id, palettes },
      keys,
      verifiedLoadQueue,
      hasCharClippingMask: true,
      hasLineart: true,
      hasCharBase: true,
      hasEyelids: false,
      discoveredPatterns: [],
      discoveredEyes: [],
      isCreatorRig: true
    };
  }
}
