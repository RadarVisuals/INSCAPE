// src/engine/systems/ShockwaveSystem.js
import { Filter, defaultFilterVert } from 'pixi.js';
import { SHOCKWAVE_FRAGMENT_SHADER } from '../shaders/ShockwaveShader.js';

export class ShockwaveSystem {
  constructor() {
    this.isActive = false;
    this.time = 0;

    // Instantiate custom cascading portal refraction shader setup
    this.filter = Filter.from({
      gl: {
        vertex: defaultFilterVert,
        fragment: SHOCKWAVE_FRAGMENT_SHADER
      },
      resources: {
        shockwaveUniforms: {
          uCenter: { value: [0.0, 0.0], type: 'vec2<f32>' },
          uScreenSize: { value: [1.0, 1.0], type: 'vec2<f32>' },
          uRadii: { value: new Float32Array([0, 0, 0, 0, 0]), type: 'f32', size: 5 },
          uActiveWaveCount: { value: 0.0, type: 'f32' },
          uThickness: { value: 160.0, type: 'f32' },
          uAmplitude: { value: 30.0, type: 'f32' }
        }
      }
    });
  }

  /**
   * Resets progress and targets expanding ripples relative to coordinate center.
   * @param {Object} headPosition - Source coordinate origin.
   * @param {number} scale - Global canvas master container scale factor.
   * @param {number} screenWidth - Active canvas width.
   * @param {number} screenHeight - Active canvas height.
   */
  trigger(headPosition, scale, screenWidth, screenHeight) {
    this.isActive = true;
    this.time = 0;

    const unis = this.filter.resources.shockwaveUniforms.uniforms;
    const screenX = screenWidth / 2 + headPosition.x * scale;
    const screenY = screenHeight / 2 + headPosition.y * scale;

    // Map screen-pixel coordinates to gl_FragCoord space (bottom-left origin)
    unis.uCenter = [screenX, screenHeight - screenY];
    unis.uScreenSize = [screenWidth, screenHeight];

    // Reset wave tracking properties
    unis.uRadii = new Float32Array([0, 0, 0, 0, 0]);
    unis.uActiveWaveCount = 0.0;
  }

  /**
   * Updates wave progression and manipulates WebGL uniforms.
   * @param {number} dtSeconds - Delta frame time in seconds.
   * @param {number} screenWidth - Active canvas width.
   * @param {number} screenHeight - Active canvas height.
   * @param {Object} config - Normalized application state variables.
   * @returns {boolean} True if WebGL filters should remain attached to the container.
   */
  update(dtSeconds, screenWidth, screenHeight, config) {
    if (!this.isActive) return false;

    this.time += dtSeconds;
    const maxScreenRadius = Math.max(screenWidth, screenHeight) * 1.15;

    const duration = config.shockwaveDuration ?? 1.8;
    const pulseCount = Math.max(1, Math.min(5, config.shockwavePulseCount ?? 2));
    const strength = config.shockwaveStrength ?? 1.0;
    const thickness = config.shockwaveThickness ?? 160.0;
    const waveDelay = 0.35;

    const unis = this.filter.resources.shockwaveUniforms.uniforms;
    unis.uScreenSize = [screenWidth, screenHeight];
    unis.uThickness = thickness;
    unis.uAmplitude = strength * 45.0; // Scaled displacement index

    let activeCount = 0;
    const radii = new Float32Array([0, 0, 0, 0, 0]);

    for (let i = 0; i < pulseCount; i++) {
      const waveStartTime = i * waveDelay;
      if (this.time >= waveStartTime) {
        const waveAge = this.time - waveStartTime;
        const waveProgress = waveAge / duration;

        if (waveProgress < 1.0) {
          radii[i] = waveProgress * maxScreenRadius;
          activeCount++;
        }
      }
    }

    unis.uRadii = radii;
    unis.uActiveWaveCount = activeCount;

    // Clean up filter execution overhead once ripples fade past active boundaries
    if (activeCount === 0 && this.time > (pulseCount * waveDelay)) {
      this.isActive = false;
      return false;
    }

    return true;
  }

  destroy() {
    if (this.filter) {
      this.filter.destroy();
      this.filter = null;
    }
    this.isActive = false;
  }
}