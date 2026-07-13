import { Container, Graphics, Sprite } from 'pixi.js';

const GAZE_TRAVEL = 65;
const LID_TRAVEL = 180;

function createCenteredSprite(alias) {
  const sprite = Sprite.from(alias);
  sprite.anchor.set(0.5);
  return sprite;
}

function parseHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(value || '') ? Number.parseInt(value.slice(1), 16) : 0x6f00ff;
}

export class CreatorEyeSystem {
  constructor(parent, aliases) {
    this.parent = parent;
    this.aliases = aliases;
    this.instances = new Map();
  }

  createInstance(id) {
    const root = new Container();
    root.label = `creator_eye_${id}`;
    const white = createCenteredSprite(this.aliases.white);
    const irisMask = createCenteredSprite(this.aliases.irisMask);
    const irisColor = new Graphics();
    irisColor.rect(-1000, -1000, 2000, 2000).fill({ color: 0x6f00ff });
    irisColor.setMask({ mask: irisMask, channel: 'alpha' });
    const pupil = createCenteredSprite(this.aliases.pupil);
    const glint = createCenteredSprite(this.aliases.glint);
    const lidTop = createCenteredSprite(this.aliases.lidTop);
    const lidBottom = createCenteredSprite(this.aliases.lidBottom);

    root.addChild(white, irisMask, irisColor, pupil, glint, lidTop, lidBottom);
    this.parent.addChild(root);
    const instance = { root, irisMask, irisColor, pupil, glint, lidTop, lidBottom, color: '#6f00ff' };
    this.instances.set(id, instance);
    return instance;
  }

  update(config, time) {
    const eyes = Array.isArray(config.creatorEyes) ? config.creatorEyes : [];
    const activeIds = new Set(eyes.map((eye) => eye.id));
    for (const [id, instance] of this.instances) {
      if (!activeIds.has(id)) {
        instance.irisColor.mask = null;
        instance.root.destroy({ children: true });
        this.instances.delete(id);
      }
    }

    for (const eye of eyes) {
      const instance = this.instances.get(eye.id) || this.createInstance(eye.id);
      instance.root.position.set(eye.x ?? 0, eye.y ?? 0);
      instance.root.scale.set(eye.scale ?? 1);
      instance.root.rotation = (eye.rotation ?? 0) * (Math.PI / 180);

      const gazeX = (eye.gazeX ?? 0) * GAZE_TRAVEL;
      const gazeY = (eye.gazeY ?? 0) * GAZE_TRAVEL;
      instance.irisMask.position.set(gazeX, gazeY);
      instance.irisColor.position.set(gazeX, gazeY);
      instance.pupil.position.set(gazeX, gazeY);
      instance.glint.position.set(gazeX, gazeY);

      if (instance.color !== eye.irisColor) {
        instance.color = eye.irisColor;
        instance.irisColor.clear().rect(-1000, -1000, 2000, 2000).fill({ color: parseHexColor(eye.irisColor) });
      }

      let openness = Math.max(0, Math.min(1, eye.eyelidOpen ?? 1));
      if (config.autoBlink !== false) {
        const interval = Math.max(1, config.blinkInterval ?? 5);
        const blinkDuration = Math.max(0.08, 0.24 / Math.max(0.2, config.blinkSpeed ?? 1));
        const blinkTime = time % interval;
        if (blinkTime < blinkDuration) {
          const phase = blinkTime / blinkDuration;
          openness *= Math.abs(phase * 2 - 1);
        }
      }
      instance.lidTop.y = -openness * LID_TRAVEL;
      instance.lidBottom.y = openness * LID_TRAVEL;
    }
  }

  destroy() {
    for (const instance of this.instances.values()) {
      instance.irisColor.mask = null;
      instance.root.destroy({ children: true });
    }
    this.instances.clear();
  }
}
