// src/engine/filters/OrganicWarpFilterFactory.js
import { Filter, UniformGroup, defaultFilterVert } from 'pixi.js';
import { ORGANIC_WARP_FRAGMENT_SHADER } from '../shaders/OrganicWarpShader.js';

export function createOrganicWarpFilter(layerIndex = 0) {
  const layerDirection = layerIndex % 2 === 0 ? 1.0 : -1.0;
  const organicWarpUniforms = new UniformGroup({
    uTime: { value: 0.0, type: 'f32' },
    uWarpIntensity: { value: 20.0, type: 'f32' },
    uMorphRange: { value: 1.0, type: 'f32' },
    uLayerDivergence: { value: 0.3, type: 'f32' },
    uLayerDirection: { value: layerDirection, type: 'f32' },
    uLayerPhase: { value: layerIndex * 2.39996, type: 'f32' },
    uCursorPosition: { value: [0.5, 0.5], type: 'vec2<f32>' },
    uCursorVelocity: { value: [0.0, 0.0], type: 'vec2<f32>' },
    uCursorActive: { value: 0.0, type: 'f32' },
    uCursorInfluence: { value: 0.45, type: 'f32' },
    uCursorRadius: { value: 0.22, type: 'f32' }
  }, false, true);

  const filter = Filter.from({
    gl: {
      vertex: defaultFilterVert,
      fragment: ORGANIC_WARP_FRAGMENT_SHADER
    },
    resources: {
      organicWarpUniforms
    }
  });

  filter.padding = 40;
  return filter;
}
