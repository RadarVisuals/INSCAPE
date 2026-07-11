// src/engine/systems/SearchlightSystem.js
import { Container, Sprite, Texture } from 'pixi.js';

export class SearchlightSystem {
  /**
   * Initializes the searchlight.
   * @param {Container} parentContainer - Target node (usually masterContainer).
   */
  constructor(parentContainer) {
    this.parentContainer = parentContainer;

    this.container = new Container();
    this.container.zIndex = 4; // Renders on top of character graphics but below overlays
    this.parentContainer.addChild(this.container);

    // Generate our soft gradient beam texture on startup
    if (!SearchlightSystem.beamTexture) {
      SearchlightSystem.beamTexture = SearchlightSystem.generateVolumetricTexture();
    }

    // Allocate 1 single searchlight beam sprite pointing at target coordinates [3]
    this.beamSprite = new Sprite(SearchlightSystem.beamTexture);
    this.beamSprite.anchor.set(0.5, 0.0); // Pivots directly at the tapered top-center of the cone [3]
    
    // Normal blending ensures the beam is 100% opaque and blocks the background [3]
    this.beamSprite.blendMode = 'normal';
    
    this.container.addChild(this.beamSprite);
  }

  /**
   * Programmatically creates a solid conical texture.
   * Features razor-sharp lateral edges and short, snappy linear gradients at 
   * the front and end to smoothly transition the beam [3].
   * @returns {Texture} Memoized volumetric texture.
   */
  static generateVolumetricTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Remove any filters to keep the side edges completely sharp
    ctx.filter = 'none';

    // Linear gradient along the Y-axis (from root to end) [3]
    const grad = ctx.createLinearGradient(64, 0, 64, 512);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');  // Starts transparent at 0%
    grad.addColorStop(0.06, 'rgba(255, 255, 255, 1.0)'); // Short 6% fade-in to 100% opacity [3]
    grad.addColorStop(0.94, 'rgba(255, 255, 255, 1.0)'); // Stays 100% opaque [3]
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');  // Short 6% fade-out at the tip [3]

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(56, 10);    // Root top-left
    ctx.lineTo(72, 10);    // Root top-right
    ctx.lineTo(112, 502);  // End bottom-right
    ctx.lineTo(16, 502);   // End bottom-left
    ctx.closePath();
    ctx.fill();

    return Texture.from(canvas);
  }

  /**
   * Programmatically generates a high-visibility Tracer Round texture on a 32x8 horizontal canvas.
   * Features a solid hot-orange background with a tight, solid-white superheated lead core in the center.
   * @returns {Texture} Memoized tracer round texture.
   */
  static generateTracerTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');

    ctx.filter = 'none';
    ctx.clearRect(0, 0, 32, 8);

    // Fill entire canvas with solid, hot-orange background (#ff9900)
    ctx.fillStyle = '#ff9900';
    ctx.fillRect(0, 0, 32, 8);

    // Overlap tight solid-white rectangle (#ffffff) in the center
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(4, 2, 24, 4);

    return Texture.from(canvas);
  }

  /**
   * Translates start coordinates onto the character's custom perimeter orbit and scales length dynamically.
   * @param {{x: number, y: number}} characterPos - World coordinates of the head container.
   * @param {{x: number, y: number}} targetGlobalPos - Focal target coordinates (absolute mouse cursor).
   * @param {number} deltaTime - Frame step timing factor.
   * @param {Object} config - State config containing active visual preferences.
   */
  update(characterPos, targetGlobalPos, deltaTime, config) {
    // Currently bypassed for testing. Container visibility forced to false.
    this.container.visible = false;
  }

  destroy() {
    if (this.container) {
      this.parentContainer.removeChild(this.container);
      this.container.destroy({ children: true });
      this.container = null;
    }
    this.beamSprite = null;
  }
}