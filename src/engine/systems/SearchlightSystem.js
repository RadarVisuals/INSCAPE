// src/engine/systems/SearchlightSystem.js
import { Container, Graphics, FillGradient } from 'pixi.js';

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

    // Create a native Graphics instance instead of drawing to an HTML Canvas
    this.beamGraphics = new Graphics();
    this.container.addChild(this.beamGraphics);
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
    const localCenter = characterPos; 
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

    this.beamGraphics.position.set(startX, startY);
    this.beamGraphics.rotation = angle - Math.PI / 2; // Aligns vertical canvas texture direction

    // Decelerate beam lengths automatically as the mouse gets closer to the center [3]
    const beamDistance = Math.max(0, distToCenter - orbitRadius);

    // Calculate dynamic RGB tints
    const rTint = config.searchlightColorR ?? 255;
    const gTint = config.searchlightColorG ?? 255;
    const bTint = config.searchlightColorB ?? 255;
    this.beamGraphics.tint = (rTint << 16) + (gTint << 8) + bTint;

    const beamLength = beamDistance * (config.searchlightLength ?? 1.0);
    const bottomWidth = Math.max(4, Math.min(beamLength * 0.20, 128) * (config.searchlightWidth ?? 1.0));
    const topWidth = bottomWidth / 6;

    this.beamGraphics.clear();

    if (beamLength > 1) {
      // Create volumetric linear gradient matching the original canvas texture
      const gradient = new FillGradient(0, 0, 0, beamLength);
      gradient.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');  // Starts transparent at 0%
      gradient.addColorStop(0.06, 'rgba(255, 255, 255, 1.0)'); // Short 6% fade-in to 100% opacity
      gradient.addColorStop(0.94, 'rgba(255, 255, 255, 1.0)'); // Stays 100% opaque
      gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');  // Short 6% fade-out at the tip

      const halfTop = topWidth / 2;
      const halfBottom = bottomWidth / 2;

      // Draw tapered cone geometry procedurally
      this.beamGraphics
        .moveTo(-halfTop, 0)
        .lineTo(halfTop, 0)
        .lineTo(halfBottom, beamLength)
        .lineTo(-halfBottom, beamLength)
        .closePath()
        .fill({ fill: gradient });
    }
  }

  destroy() {
    if (this.container) {
      this.parentContainer.removeChild(this.container);
      this.container.destroy({ children: true });
      this.container = null;
    }
    this.beamGraphics = null;
  }
}