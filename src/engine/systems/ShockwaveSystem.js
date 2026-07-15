// src/engine/systems/ShockwaveSystem.js
import { EffectFactory } from '../filters/EffectFactory.js';

export class ShockwaveSystem {
  constructor() {
    this.isActive = false;
    this.time = 0;

    // Delegate compilation to the central factory
    this.filter = EffectFactory.createShockwaveFilter();
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

    unis.uCenter = [screenX, screenHeight - screenY];
    unis.uScreenSize = [screenWidth, screenHeight];

    unis.uRadii = new Float32Array([0, 0, 0, 0, 0]);
    unis.uActiveWaveCount = 0.0;
  }

  /**
   * Updates wave progression and manipulates WebGL uniforms.
   * @param {number} dtSeconds - Delta frame time in seconds.
   * @param {number} screenWidth - Active canvas width.
   * @param {number} screenHeight - Active canvas height.
   * @param {Object} config - Persistent shockwave configuration.
   * @returns {boolean} True if WebGL filters should remain attached to the container.
   */
  update(dtSeconds, screenWidth, screenHeight, config) {
    if (!this.isActive) return false;

    this.time += dtSeconds;
    const maxScreenRadius = Math.max(screenWidth, screenHeight) * 1.15;

    const duration = config.duration;
    const pulseCount = config.pulseCount;
    const strength = config.strength;
    const thickness = config.thickness;
    const waveDelay = 0.35;

    const unis = this.filter.resources.shockwaveUniforms.uniforms;
    unis.uScreenSize = [screenWidth, screenHeight];
    unis.uThickness = thickness;
    unis.uAmplitude = strength * 45.0; 

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
