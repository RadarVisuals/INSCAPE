// src/engine/assets/AssetResolver.js
import { Texture, Assets } from 'pixi.js';

/**
 * Validates the physical existence of an asset in the public folder before caching.
 * @param {string} src - Path to the asset.
 * @returns {Promise<boolean>}
 */
export async function testImageAsset(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

export class AssetResolver {
  /**
   * Pads IDs to 2-digit strings for matching standard file structures.
   * @param {number|string} id 
   * @returns {string}
   */
  static padId(id) {
    return typeof id === 'number' ? String(id).padStart(2, '0') : id;
  }

  /**
   * Probes active actor directories and backdrops to construct a verified load payload.
   * @param {Object} config - System setup values from the application state.
   * @returns {Promise<Object>} Resolved configuration states, cache keys, and assets load queue.
   */
  static async resolveRig(config) {
    const { characterId, bgClippingMaskId, bgPatternStyle, bgMountainId, bgMountainBackId } = config;
    const verifiedLoadQueue = [];

    const formattedMountainId = this.padId(bgMountainId);
    const formattedMountainBackId = this.padId(bgMountainBackId);

    const keys = {
      bg_clipping_mask: `bg_clipping_mask_${bgClippingMaskId}`,
      bg_pat_1: `bg_pat_1_${bgPatternStyle}`,
      bg_pat_2: `bg_pat_2_${bgPatternStyle}`,
      bg_mountain: `bg_mountain_${formattedMountainId}`,
      bg_mountain_back: `bg_mountain_back_${formattedMountainBackId}`,
      char_clipping_mask: `char_clipping_mask_${characterId}`,
      char_lineart: `char_lineart_${characterId}`,
      eyelids_top: `eyelids_top_${characterId}`,
      eyelids_bottom: `eyelids_bottom_${characterId}`
    };

    const results = {
      keys,
      hasBgClippingMask: false,
      hasBgPat1: false,
      hasBgPat2: false,
      hasBgMountain: false,
      hasBgMountainBack: false,
      hasCharClippingMask: false,
      hasLineart: false,
      hasEyelids: false,
      isPanoramaMode: false,
      hasBg2: false,
      discoveredPatterns: [],
      discoveredEyes: [],
      verifiedLoadQueue
    };

    // --- Current Stage Asset Contract ---
    // 1. Backdrop Color
    const bgClipPath = `/assets/stage/backdrops/backdrop_${bgClippingMaskId}.webp`;
    results.hasBgClippingMask = await testImageAsset(bgClipPath);
    if (results.hasBgClippingMask) {
      verifiedLoadQueue.push({ alias: keys.bg_clipping_mask, src: bgClipPath });
    } else {
      Assets.cache.set(keys.bg_clipping_mask, Texture.EMPTY);
    }

    // 2. Background Flat Patterns (style_bottom and style_top)
    const bgPat1Path = `/assets/stage/patterns/${bgPatternStyle}_top.webp`;
    const bgPat2Path = `/assets/stage/patterns/${bgPatternStyle}_bottom.webp`;
    results.hasBgPat1 = await testImageAsset(bgPat1Path);
    results.hasBgPat2 = await testImageAsset(bgPat2Path);

    if (results.hasBgPat1) {
      verifiedLoadQueue.push({ alias: keys.bg_pat_1, src: bgPat1Path });
    }
    if (results.hasBgPat2) {
      verifiedLoadQueue.push({ alias: keys.bg_pat_2, src: bgPat2Path });
    }

    // 3. Foreground Mountains Layer
    const mountainPath = `/assets/stage/mountains/mountain_${formattedMountainId}.webp`;
    results.hasBgMountain = await testImageAsset(mountainPath);
    if (results.hasBgMountain) {
      verifiedLoadQueue.push({ alias: keys.bg_mountain, src: mountainPath });
    } else {
      Assets.cache.set(keys.bg_mountain, Texture.EMPTY);
    }

    // 4. Background Mountains Layer
    const mountainBackPath = `/assets/stage/mountains/mountain_${formattedMountainBackId}.webp`;
    results.hasBgMountainBack = await testImageAsset(mountainBackPath);
    if (results.hasBgMountainBack) {
      verifiedLoadQueue.push({ alias: keys.bg_mountain_back, src: mountainBackPath });
    } else {
      Assets.cache.set(keys.bg_mountain_back, Texture.EMPTY);
    }

    // --- Foreground Character Clipping Mask ---
    const charClipPath = `/assets/actors/${characterId}/mask.webp`;
    results.hasCharClippingMask = await testImageAsset(charClipPath);
    if (results.hasCharClippingMask) {
      verifiedLoadQueue.push({ alias: keys.char_clipping_mask, src: charClipPath });
    } else {
      Assets.cache.set(keys.char_clipping_mask, Texture.EMPTY);
    }

    // --- Foreground Character Patterns ---
    let patternIndex = 1;
    while (true) {
      const idxStr = this.padId(patternIndex);
      const patPath = `/assets/actors/${characterId}/patterns/pattern_${idxStr}.webp`;
      const exists = await testImageAsset(patPath);
      if (!exists) break;

      const alias = `char_${characterId}_pattern_${patternIndex}`;
      verifiedLoadQueue.push({ alias, src: patPath });
      results.discoveredPatterns.push(alias);
      patternIndex++;
      if (patternIndex > 30) break;
    }

    // --- Foreground Character Lineart ---
    const lineartPath = `/assets/actors/${characterId}/lineart.webp`;
    results.hasLineart = await testImageAsset(lineartPath);
    if (results.hasLineart) {
      verifiedLoadQueue.push({ alias: keys.char_lineart, src: lineartPath });
    } else {
      Assets.cache.set(keys.char_lineart, Texture.EMPTY);
    }

    // --- Foreground Character Dynamic Eye Sockets ---
    let socketIndex = 1;
    while (true) {
      const idxStr = this.padId(socketIndex);
      const eyeballPath = `/assets/actors/${characterId}/eyes/socket_${idxStr}/eyeball.webp`;
      const pupilPath = `/assets/actors/${characterId}/eyes/socket_${idxStr}/pupil.webp`;

      const hasEyeball = await testImageAsset(eyeballPath);
      const hasPupil = await testImageAsset(pupilPath);

      if (!hasEyeball && !hasPupil) break;

      const scleraAlias = `char_${characterId}_eye_sclera_${socketIndex}`;
      const pupilAlias = `char_${characterId}_eye_pupil_${socketIndex}`;

      if (hasEyeball) verifiedLoadQueue.push({ alias: scleraAlias, src: eyeballPath });
      if (hasPupil) verifiedLoadQueue.push({ alias: pupilAlias, src: pupilPath });

      results.discoveredEyes.push({
        id: socketIndex,
        scleraAlias: hasEyeball ? scleraAlias : null,
        pupilAlias: hasPupil ? pupilAlias : null
      });

      socketIndex++;
      if (socketIndex > 30) break;
    }

    // --- Foreground Character Eyelids ---
    const eyelidsTopPath = `/assets/actors/${characterId}/eyes/eyelids_top.webp`;
    const eyelidsBottomPath = `/assets/actors/${characterId}/eyes/eyelids_bottom.webp`;
    const hasEyelidsTop = await testImageAsset(eyelidsTopPath);
    const hasEyelidsBottom = await testImageAsset(eyelidsBottomPath);

    if (hasEyelidsTop && hasEyelidsBottom) {
      verifiedLoadQueue.push({ alias: keys.eyelids_top, src: eyelidsTopPath });
      verifiedLoadQueue.push({ alias: keys.eyelids_bottom, src: eyelidsBottomPath });
      results.hasEyelids = true;
    } else {
      Assets.cache.set(keys.eyelids_top, Texture.EMPTY);
      Assets.cache.set(keys.eyelids_bottom, Texture.EMPTY);
    }

    return results;
  }
}
