import { Container, Graphics } from 'pixi.js';

const TOP = 'ceiling';
const BOTTOM = 'floor';
const ACTOR_SCREEN_X = 0.15;
const CRUISE_SPEED = 210;
const MAX_FORWARD_SPEED = 760;

export class GrapplePrototypeSystem {
  constructor() {
    this.container = new Container();
    this.container.label = 'grapple_prototype';
    this.tetherGraphic = new Graphics();
    this.anchorContainer = new Container();
    this.container.addChild(this.tetherGraphic, this.anchorContainer);

    this.viewportWidth = 1600;
    this.viewportHeight = 1200;
    this.position = { x: 0, y: 0 };
    this.velocity = { x: CRUISE_SPEED, y: -40 };
    this.cameraX = 0;
    this.anchors = [];
    this.nextAnchorId = 1;
    this.nextSurface = TOP;
    this.attachedAnchor = null;
    this.initialRopeLength = 0;
    this.ropeLength = 0;
    this.charge = 0;
    this.holdTime = 0;
    this.state = 'ready';
    this.distance = 0;
    this.worldSpeed = 0;
    this.hudElapsed = 0;
    this.resize(this.viewportWidth, this.viewportHeight);
    this.reset();
  }

  resize(width, height) {
    this.viewportWidth = Math.max(800, width || 1600);
    this.viewportHeight = Math.max(700, height || 1200);
    const halfHeight = this.viewportHeight / 2;
    for (const anchor of this.anchors) {
      anchor.y = anchor.surface === TOP ? -halfHeight + 105 : halfHeight - 125;
    }
    this.updateCamera();
    this.syncAnchorGraphics();
  }

  reset() {
    for (const anchor of this.anchors) anchor.graphic.destroy();
    this.anchors = [];
    this.nextAnchorId = 1;
    this.nextSurface = TOP;
    this.attachedAnchor = null;
    this.position.x = 0;
    this.position.y = 0;
    this.velocity.x = CRUISE_SPEED;
    this.velocity.y = -40;
    this.charge = 0;
    this.holdTime = 0;
    this.distance = 0;
    this.worldSpeed = 0;
    this.state = 'ready';
    this.updateCamera();
    this.seedAnchors();
    this.syncAnchorGraphics();
    this.drawTether();
    this.emitHud(true);
  }

  seedAnchors() {
    let x = this.position.x + 330;
    for (let index = 0; index < 8; index += 1) {
      this.createAnchor(x, this.nextSurface);
      this.nextSurface = this.nextSurface === TOP ? BOTTOM : TOP;
      x += 390 + Math.random() * 135;
    }
  }

  createAnchor(x, surface) {
    const halfHeight = this.viewportHeight / 2;
    const y = surface === TOP ? -halfHeight + 105 : halfHeight - 125;
    const color = surface === TOP ? 0x00eaff : 0xff9d00;
    const graphic = new Graphics()
      .circle(0, 0, 24).stroke({ color, width: 4, alpha: 0.82 })
      .circle(0, 0, 7).fill({ color, alpha: 0.95 });
    graphic.position.set(this.toScreenX(x), y);
    this.anchorContainer.addChild(graphic);
    this.anchors.push({ id: this.nextAnchorId++, x, y, surface, graphic });
  }

  press(surface) {
    if (this.state === 'dead') {
      this.reset();
      return;
    }
    if (this.state === 'ready') this.state = 'running';
    if (this.attachedAnchor) return;

    const candidates = this.anchors
      .filter((anchor) => anchor.surface === surface && anchor.x > this.position.x - 80)
      .map((anchor) => ({
        anchor,
        distance: Math.hypot(anchor.x - this.position.x, anchor.y - this.position.y)
      }))
      .filter((candidate) => candidate.distance < 980)
      .sort((a, b) => a.distance - b.distance);

    if (candidates.length === 0) return;
    this.attachedAnchor = candidates[0].anchor;
    this.initialRopeLength = Math.max(180, candidates[0].distance);
    this.ropeLength = this.initialRopeLength;
    this.charge = 0;
    this.holdTime = 0;
    this.emitHud(true);
  }

  release() {
    if (!this.attachedAnchor) return;
    const dx = this.position.x - this.attachedAnchor.x;
    const dy = this.position.y - this.attachedAnchor.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const radialX = dx / length;
    const radialY = dy / length;
    const launchPower = 155 + this.charge * 330;

    this.velocity.x += 180 + this.charge * 360 + radialX * launchPower * 0.22;
    this.velocity.y += radialY * launchPower;
    this.attachedAnchor = null;
    this.charge = 0;
    this.holdTime = 0;
    this.emitHud(true);
  }

  update(deltaSeconds) {
    const dt = Math.min(0.033, Math.max(0, deltaSeconds));
    if (this.state === 'ready') {
      this.position.y = Math.sin(performance.now() * 0.0015) * 18;
      this.drawTether();
      this.emitHud();
      return this.getPose();
    }
    if (this.state === 'dead') {
      this.drawTether();
      this.emitHud();
      return this.getPose();
    }

    const previousWorldX = this.position.x;
    this.velocity.y += 485 * dt;
    this.velocity.x += (CRUISE_SPEED - this.velocity.x) * 0.55 * dt;
    this.velocity.x = Math.max(90, Math.min(MAX_FORWARD_SPEED, this.velocity.x));
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    if (this.attachedAnchor) {
      this.holdTime += dt;
      this.charge = Math.min(1, this.holdTime / 1.15);
      this.ropeLength = this.initialRopeLength * (1 - this.charge * 0.42);
      this.applyRopeConstraint();
      if (this.holdTime > 2.35) this.release();
    }

    const forwardTravel = this.position.x - previousWorldX;
    this.worldSpeed = dt > 0 ? forwardTravel / dt : 0;
    this.distance += Math.max(0, forwardTravel) * 0.02;
    this.updateCamera();
    this.recycleAnchors();
    this.syncAnchorGraphics();

    const halfHeight = this.viewportHeight / 2;
    if (this.position.y > halfHeight + 115 || this.position.y < -halfHeight - 115) {
      this.attachedAnchor = null;
      this.state = 'dead';
      this.velocity.x = 0;
      this.velocity.y = 0;
      this.worldSpeed = 0;
      this.emitHud(true);
    }

    this.drawTether();
    this.emitHud();
    return this.getPose();
  }

  applyRopeConstraint() {
    const anchor = this.attachedAnchor;
    const dx = this.position.x - anchor.x;
    const dy = this.position.y - anchor.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / distance;
    const ny = dy / distance;

    this.position.x = anchor.x + nx * this.ropeLength;
    this.position.y = anchor.y + ny * this.ropeLength;
    const radialVelocity = this.velocity.x * nx + this.velocity.y * ny;
    this.velocity.x -= radialVelocity * nx;
    this.velocity.y -= radialVelocity * ny;
    this.velocity.x += 46 * (0.35 + this.charge) * (this.attachedAnchor.surface === TOP ? 1 : 0.8);
  }

  recycleAnchors() {
    const leftEdge = this.cameraX - this.viewportWidth / 2 - 180;
    for (let index = this.anchors.length - 1; index >= 0; index -= 1) {
      const anchor = this.anchors[index];
      if (anchor.x < leftEdge && anchor !== this.attachedAnchor) {
        anchor.graphic.destroy();
        this.anchors.splice(index, 1);
      }
    }

    let rightmost = this.anchors.reduce((maximum, anchor) => Math.max(maximum, anchor.x), -Infinity);
    const targetRight = this.cameraX + this.viewportWidth / 2 + 900;
    while (rightmost < targetRight) {
      rightmost += 390 + Math.random() * 135;
      this.createAnchor(rightmost, this.nextSurface);
      this.nextSurface = this.nextSurface === TOP ? BOTTOM : TOP;
    }
  }

  drawTether() {
    this.tetherGraphic.clear();
    if (!this.attachedAnchor) return;
    const color = this.attachedAnchor.surface === TOP ? 0x00eaff : 0xff9d00;
    this.tetherGraphic
      .moveTo(this.toScreenX(this.attachedAnchor.x), this.attachedAnchor.y)
      .lineTo(this.getActorScreenX(), this.position.y)
      .stroke({ color, width: 3 + this.charge * 9, alpha: 0.55 + this.charge * 0.4 });
  }

  getActorScreenX() {
    return -this.viewportWidth / 2 + this.viewportWidth * ACTOR_SCREEN_X;
  }

  toScreenX(worldX) {
    return worldX - this.cameraX;
  }

  updateCamera() {
    // A hard horizontal lock keeps the composition stable while all forward
    // momentum remains available to the swing simulation and scrolling world.
    this.cameraX = this.position.x - this.getActorScreenX();
  }

  syncAnchorGraphics() {
    for (const anchor of this.anchors) {
      anchor.graphic.position.set(this.toScreenX(anchor.x), anchor.y);
    }
  }

  getPose() {
    const speed = Math.hypot(this.velocity.x, this.velocity.y);
    const rotation = this.state === 'ready'
      ? 0.04
      : Math.max(-0.75, Math.min(0.75, Math.atan2(this.velocity.y, Math.max(120, this.velocity.x))));
    return {
      x: this.getActorScreenX(),
      y: this.position.y,
      scale: 0.58,
      scaleX: 0.58,
      rotation,
      speed
    };
  }

  emitHud(force = false) {
    this.hudElapsed += 1 / 60;
    if (!force && this.hudElapsed < 0.08) return;
    this.hudElapsed = 0;
    window.dispatchEvent(new CustomEvent('gothic-grapple-state', {
      detail: {
        state: this.state,
        distance: Math.floor(this.distance),
        charge: this.charge,
        attachedSurface: this.attachedAnchor?.surface || null
      }
    }));
  }

  destroy() {
    this.container.destroy({ children: true });
    this.anchors = [];
    this.attachedAnchor = null;
  }
}
