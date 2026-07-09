// src/engine/filters/WarpFilterFactory.js
import { Filter, defaultFilterVert } from 'pixi.js';
import { WARP_FRAGMENT_SHADER } from '../shaders/WarpShader';

/**
 * Creates an instance of the custom WebGL warp filter.
 * @param {number} initialIntensity - The starting warp intensity value.
 * @returns {Filter} A configured PixiJS v8 Filter instance.
 */
export function createWarpFilter(initialIntensity = 20.0) {
  const filter = Filter.from({
    gl: {
      vertex: defaultFilterVert,
      fragment: WARP_FRAGMENT_SHADER
    },
    resources: {
      warpUniforms: {
        uTime: { value: 0.0, type: 'f32' },
        uWarpIntensity: { value: initialIntensity, type: 'f32' }
      }
    }
  });

  // Assign padding to allow offsets to render past original sprite edges without harsh cuts
  filter.padding = 40; 
  return filter;
}

/**
 * Utility helper to construct separate foreground and background warp filters.
 * @returns {Object} An object containing the primary and background filters.
 */
export function createWarpFilters() {
  return {
    warpFilter: createWarpFilter(20.0),
    bgWarpFilter: createWarpFilter(20.0)
  };
}