// src/engine/systems/FogSystem.js
import { Filter, Sprite, Texture, defaultFilterVert } from 'pixi.js';
import { FOG_FRAGMENT_SHADER } from '../shaders/FogShader.js';

export class FogSystem {
  constructor(targetContainer, bgHeight, isForeground = false) {
    this.targetContainer = targetContainer;
    this.isForeground = isForeground;
    
    // Create a mesh-like sprite that covers the background area
    this.sprite = new Sprite(Texture.WHITE);
    this.sprite.anchor.set(0.5);
    this.sprite.width = bgHeight; 
    this.sprite.height = bgHeight;
    this.sprite.alpha = 1.0; 

    this.filter = Filter.from({
      gl: {
        vertex: defaultFilterVert,
        fragment: FOG_FRAGMENT_SHADER
      },
      resources: {
        fogUniforms: {
          uTime: { value: 0, type: 'f32' },
          uOpacity: { value: 0.5, type: 'f32' },
          uColor: { value: [1, 1, 1], type: 'vec3<f32>' },
          uSpeed: { value: 1.0, type: 'f32' }
        }
      }
    });

    this.sprite.filters = [this.filter];
    this.targetContainer.addChild(this.sprite);
  }

  update(time, config) {
    if (!this.filter) return;

    const unis = this.filter.resources.fogUniforms.uniforms;
    unis.uTime = time;
    
    // Foreground fog is slightly thinner to avoid obscuring character details
    const baseOpacity = this.isForeground ? config.fogOpacity * 0.55 : config.fogOpacity;
    unis.uOpacity = baseOpacity;
    
    // Foreground fog scrolls faster (simulating spatial overlay depth)
    const velocityScale = this.isForeground ? 1.45 : 0.85;
    unis.uSpeed = config.fogSpeed * 0.01 * velocityScale;
    
    // Normalize color output
    unis.uColor = [
        config.fogColorR / 255,
        config.fogColorG / 255,
        config.fogColorB / 255
    ];

    // Horizontal/Phase offsetting between the two layers prevents overlapping synchronized bobbing
    const phaseOffset = this.isForeground ? 1.6 : 0.0;
    const sway = Math.sin((time * config.fogSwaySpeed) + phaseOffset) * config.fogSwayAmp;
    
    // Sit foreground fog slightly lower on screen to overlay the lower skull fangs/chin
    const verticalCenter = this.isForeground ? (this.sprite.height * 0.28) : (this.sprite.height * 0.12);
    this.sprite.y = verticalCenter + sway;
  }

  destroy() {
    if (this.sprite) {
      this.sprite.destroy(true);
    }
  }
}