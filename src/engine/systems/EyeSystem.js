// src/engine/systems/EyeSystem.js
import { Sprite } from 'pixi.js';

export class EyeSystem {
  constructor(headContainer, options = {}) {
    this.headContainer = headContainer;
    this.discoveredEyes = options.discoveredEyes || [];
    this.hasEyelids = options.hasEyelids ?? false;
    this.eyelidsTopAlias = options.eyelidsTopAlias || null;
    this.eyelidsBottomAlias = options.eyelidsBottomAlias || null;

    this.blinkTimer = 0;
    this.isBlinking = false;
    this.blinkDurationTimer = 0;
    this.eyelidProgress = 1.0; 

    this.time = 0;

    this.eyeContainers = [];
    this.eyelidTopSprite = null;
    this.eyelidBottomSprite = null;

    this.buildSystem();
  }

  buildSystem() {
    const createSprite = (alias) => {
      const s = Sprite.from(alias);
      s.anchor.set(0.5);
      return s;
    };

    // 1. Render eyeballs & Pupils dynamically
    for (const eye of this.discoveredEyes) {
      const eyeGroup = {
        sclera: null,
        pupil: null
      };

      if (eye.scleraAlias) {
        eyeGroup.sclera = createSprite(eye.scleraAlias);
        this.headContainer.addChild(eyeGroup.sclera);
      }

      if (eye.pupilAlias) {
        eyeGroup.pupil = createSprite(eye.pupilAlias);
        this.headContainer.addChild(eyeGroup.pupil);
      }

      this.eyeContainers.push(eyeGroup);
    }

    // 2. Render Eyelids on top of all eye elements
    if (this.hasEyelids && this.eyelidsTopAlias && this.eyelidsBottomAlias) {
      this.eyelidBottomSprite = createSprite(this.eyelidsBottomAlias);
      this.eyelidTopSprite = createSprite(this.eyelidsTopAlias);

      this.headContainer.addChild(this.eyelidBottomSprite);
      this.headContainer.addChild(this.eyelidTopSprite);
    }
  }

  /**
   * Resolves the current global screen coordinates of all active eye components.
   * This is used to accurately anchor searchlight emissions dynamically.
   * @returns {Array<{x: number, y: number}>} Global coordinate positions.
   */
  getEyeGlobalPositions() {
    return this.eyeContainers
      .map(group => {
        if (group.pupil) {
          return group.pupil.getGlobalPosition();
        } else if (group.sclera) {
          return group.sclera.getGlobalPosition();
        }
        return null;
      })
      .filter(pos => pos !== null);
  }

  update(deltaTime, state) {
    const dtSeconds = deltaTime / 60;
    this.time += dtSeconds;

    // 1. EYELID BLINKING CYCLE
    if (state.autoBlink) {
      if (!this.isBlinking) {
        this.blinkTimer += dtSeconds;
        if (this.blinkTimer >= state.blinkInterval) {
          this.isBlinking = true;
          this.blinkDurationTimer = 0;
        }
        this.eyelidProgress = 1.0;
      } else {
        const blinkDuration = 0.22 / state.blinkSpeed; 
        this.blinkDurationTimer += dtSeconds;
        const phase = this.blinkDurationTimer / blinkDuration;

        if (phase >= 1.0) {
          this.isBlinking = false;
          this.blinkTimer = (Math.random() - 0.5) * 1.5; 
          this.eyelidProgress = 1.0;
        } else {
          this.eyelidProgress = 1.0 - Math.sin(phase * Math.PI);
        }
      }
    } else {
      this.eyelidProgress = state.eyelidManualProgress;
    }

    if (this.hasEyelids && this.eyelidTopSprite && this.eyelidBottomSprite) {
      const travel = state.eyelidTravel;
      const topEyelidY = -(this.eyelidProgress * travel);
      const bottomEyelidY = (this.eyelidProgress * travel);
      
      this.eyelidTopSprite.position.set(0, topEyelidY);
      this.eyelidBottomSprite.position.set(0, bottomEyelidY);
    }

    // 2. ORGANIC DYNAMIC EYE TRACKING
    const driftSpeed = 0.7;
    const driftX = Math.sin(this.time * driftSpeed) * 6 * state.pupilWander;
    const driftY = Math.cos(this.time * driftSpeed * 0.65) * 4 * state.pupilWander;

    const mouseX = state.mousePos.x * 24 * state.pupilMouseInfluence;
    const mouseY = state.mousePos.y * 14 * state.pupilMouseInfluence;

    const sharedTargetX = mouseX + driftX;
    const sharedTargetY = mouseY + driftY;

    const saccadeChance = Math.sin(this.time * 2.8) * Math.cos(this.time * 0.85);
    const triggerTwitch = saccadeChance > 0.72;

    this.eyeContainers.forEach((group, index) => {
      const seed = index * 3.5;
      const saccadeX = triggerTwitch ? Math.sin(this.time * 22.0 + seed) * 3 * state.pupilSaccade : 0;
      const saccadeY = triggerTwitch ? Math.cos(this.time * 26.0 + seed) * 2 * state.pupilSaccade : 0;

      const targetX = sharedTargetX + saccadeX;
      const targetY = sharedTargetY + saccadeY;

      if (group.pupil) {
        group.pupil.x += (targetX - group.pupil.x) * 0.16;
        group.pupil.y += (targetY - group.pupil.y) * 0.16;
      }

      if (group.sclera) {
        group.sclera.x += (targetX * 0.3 - group.sclera.x) * 0.12;
        group.sclera.y += (targetY * 0.3 - group.sclera.y) * 0.12;
      }
    });
  }

  destroy() {
    for (const group of this.eyeContainers) {
      if (group.sclera) group.sclera.destroy();
      if (group.pupil) group.pupil.destroy();
    }
    this.eyeContainers = [];

    if (this.eyelidTopSprite) {
      this.eyelidTopSprite.destroy();
      this.eyelidTopSprite = null;
    }
    if (this.eyelidBottomSprite) {
      this.eyelidBottomSprite.destroy();
      this.eyelidBottomSprite = null;
    }
  }
}