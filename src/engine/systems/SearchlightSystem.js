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
   * Translates start coordinates onto the character's custom perimeter orbit and scales length dynamically.
   * @param {{x: number, y: number}} characterPos - World coordinates of the head container.
   * @param {{x: number, y: number}} targetGlobalPos - Focal target coordinates (absolute mouse cursor).
   * @param {number} deltaTime - Frame step timing factor.
   * @param {Object} config - State config containing active visual preferences.
   */
  update(characterPos, targetGlobalPos, deltaTime, config) {
    if (!config.searchlightActive || !characterPos) {
      this.container.visible = false;
      return;
    }

    this.container.visible = true;

    // Convert screen targets into local space [3]
    const localCenter = characterPos; // Already inside coordinate space of masterContainer
    const localTarget = this.container.toLocal(targetGlobalPos);

    const dx = localTarget.x - localCenter.x;
    const dy = localTarget.y - localCenter.y;
    const distToCenter = Math.sqrt(dx * dx + dy * dy);

    // Determine target vector angle
    const angle = Math.atan2(dy, dx);

    // Pull custom orbit radius parameter from UI [3]
    const orbitRadius = config.searchlightRadius ?? 110;

    // Anchor starting coordinates directly along the circle perimeter pointing towards focus targets [3]
    const startX = localCenter.x + Math.cos(angle) * orbitRadius;
    const startY = localCenter.y + Math.sin(angle) * orbitRadius;

    this.beamSprite.position.set(startX, startY);
    this.beamSprite.rotation = angle - Math.PI / 2; // Aligns vertical canvas texture direction

    // Decelerate beam lengths automatically as the mouse gets closer to the center [3]
    const beamDistance = Math.max(0, distToCenter - orbitRadius);

    // Calculate dynamic RGB tints
    const rTint = config.searchlightColorR ?? 255;
    const gTint = config.searchlightColorG ?? 255;
    const bTint = config.searchlightColorB ?? 255;
    this.beamSprite.tint = (rTint << 16) + (gTint << 8) + bTint;

    // Adjust height and width scales relative to the proximity factor [3]
    const calculatedHeight = beamDistance * (config.searchlightLength ?? 1.0);
    this.beamSprite.height = calculatedHeight;

    const calculatedWidth = Math.min(calculatedHeight * 0.20, 128) * (config.searchlightWidth ?? 1.0);
    this.beamSprite.width = Math.max(4, calculatedWidth);
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