// src/engine/filters/EffectFactory.js
import { Filter, BlurFilter, ColorMatrixFilter, defaultFilterVert, UniformGroup } from 'pixi.js';
import { RGBSplitFilter } from 'pixi-filters';
import { FOG_FRAGMENT_SHADER } from '../shaders/FogShader.js';
import { SHOCKWAVE_FRAGMENT_SHADER } from '../shaders/ShockwaveShader.js';

export class EffectFactory {
  /**
   * Generates a pre-configured RGBSplit chromatic aberration filter
   */
  static createChromaticAberration() {
    return new RGBSplitFilter({
      red: { x: 0, y: 0 },
      green: { x: 0, y: 0 },
      blue: { x: 0, y: 0 }
    });
  }

  /**
   * Generates a pre-configured Blur filter with safety padding to prevent edge cuts
   * @param {number} initialStrength - Starting blur intensity
   */
  static createAuraBlur(initialStrength = 20) {
    const filter = new BlurFilter({ strength: initialStrength });
    filter.padding = 100; // Protect against hard bounding box clips during large pulses
    return filter;
  }

  /**
   * Generates a standard Color Matrix Filter
   */
  static createColorMatrix() {
    return new ColorMatrixFilter();
  }

  /**
   * Compiles and instantiates the custom WebGL Fog/Atmosphere shader using a typed UniformGroup UBO
   */
  static createFogFilter() {
    const fogUniformGroup = new UniformGroup({
      uTime: { value: 0, type: 'f32' },
      uOpacity: { value: 0.5, type: 'f32' },
      uColor: { value: [1, 1, 1], type: 'vec3<f32>' },
      uSpeed: { value: 1.0, type: 'f32' }
    }, false, true);

    return Filter.from({
      gl: {
        vertex: defaultFilterVert,
        fragment: FOG_FRAGMENT_SHADER
      },
      resources: {
        fogUniforms: fogUniformGroup
      }
    });
  }

  /**
   * Compiles and instantiates the custom WebGL Shockwave shader.
   * Sets the third parameter of UniformGroup (useUbo) to false to prevent std140 stride alignment issues.
   */
  static createShockwaveFilter() {
    const shockwaveUniformGroup = new UniformGroup({
      uCenter: { value: [0.0, 0.0], type: 'vec2<f32>' },
      uScreenSize: { value: [1.0, 1.0], type: 'vec2<f32>' },
      uRadii: { value: new Float32Array([0, 0, 0, 0, 0]), type: 'f32', size: 5 },
      uActiveWaveCount: { value: 0.0, type: 'f32' },
      uThickness: { value: 160.0, type: 'f32' },
      uAmplitude: { value: 30.0, type: 'f32' }
    }, false, false); // Disabled UBO to ensure correct scalar packing structure in WebGL2

    return Filter.from({
      gl: {
        vertex: defaultFilterVert,
        fragment: SHOCKWAVE_FRAGMENT_SHADER
      },
      resources: {
        shockwaveUniforms: shockwaveUniformGroup
      }
    });
  }
}