import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { Clock, defaults, evaluate, fit, formats, geometry, mirrorTransforms, validate } from './core.js';

// One instance owns its renderer, texture, image load, observer and RAF.
export async function createMirrorModule(element, { onChange = () => {}, onStatus = () => {} } = {}) {
  const app = new Application();
  await app.init({ width: 1, height: 1, backgroundAlpha: 0, antialias: true, autoStart: false, preference: 'webgl', autoDensity: true });
  element.append(app.canvas);
  app.canvas.setAttribute('aria-label', 'Mirror artwork');
  let settings = defaults(), disposed = false, paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let texture = null, sequence = 0, cancelLoad = null, request = 0, viewport = null;
  let helpers = { grid: false, guides: false, perspective: false };
  const clock = new Clock(), world = new Container(), pair = new Container();
  const source = new Sprite(), mirror = new Sprite(), leftMask = new Graphics(), rightMask = new Graphics();
  const grid = new Graphics(), guides = new Graphics();
  source.anchor.set(0.5); mirror.anchor.set(0.5);
  pair.addChild(source, mirror, leftMask, rightMask);
  // Static half-planes in local coordinates, shared edge exactly at zero.
  leftMask.rect(-4000, -4000, 4000, 8000).fill(0xffffff);
  rightMask.rect(0, -4000, 4000, 8000).fill(0xffffff);
  source.mask = leftMask; mirror.mask = rightMask;
  world.addChild(grid, pair, guides); app.stage.addChild(world);
  function alive() { if (disposed) throw new Error('Deze module is opgeruimd.'); }
  function resize() {
    if (disposed) return;
    viewport = fit(element.clientWidth, element.clientHeight, settings.format, devicePixelRatio);
    app.canvas.hidden = !viewport.zoom;
    if (!viewport.zoom) { clock.last = null; return; }
    app.renderer.resize(viewport.width, viewport.height, viewport.resolution);
    world.scale.set(viewport.zoom);
    draw();
  }
  function draw() {
    if (disposed || !viewport?.zoom) return;
    const [sw, sh] = formats[settings.format];
    grid.clear(); guides.clear();
    if (helpers.grid) {
      for (let x = 0; x <= sw; x += 100) grid.moveTo(x, 0).lineTo(x, sh);
      for (let y = 0; y <= sh; y += 100) grid.moveTo(0, y).lineTo(sw, y);
      grid.stroke({ color: 0xd8d7d2, alpha: 0.18, width: 1 / viewport.zoom });
    }
    if (helpers.perspective) {
      // A fixed front opening and a recessed back wall: no 3D artwork transform.
      const inset = 0.24, bx = sw * inset, by = sh * inset;
      for (let i = 0; i <= 12; i++) {
        const t = i / 12, x = sw * t, y = sh * t;
        const backX = bx + (sw - 2 * bx) * t, backY = by + (sh - 2 * by) * t;
        grid.moveTo(x, 0).lineTo(backX, by).lineTo(backX, sh - by).lineTo(x, sh);
        grid.moveTo(0, y).lineTo(bx, backY).lineTo(sw - bx, backY).lineTo(sw, y);
      }
      for (let i = 0; i <= 8; i++) {
        const scale = 1 / (1 + (1 / (1 - 2 * inset) - 1) * i / 8);
        grid.rect(sw * (1 - scale) / 2, sh * (1 - scale) / 2, sw * scale, sh * scale);
      }
      grid.stroke({ color: 0xd8d7d2, alpha: 0.25, width: 1 / viewport.zoom });
    }
    pair.visible = !!texture;
    if (texture) {
      const values = evaluate(settings, clock.time);
      const g = geometry(texture.width, texture.height, values, settings.format);
      pair.position.set(g.axisX, g.axisY); pair.scale.set(g.scale);
      const transforms = mirrorTransforms(g.w, g.h, values.distance, settings.axis, values.rotation, settings.flipHorizontal);
      for (const [sprite, transform] of [[source, transforms.source], [mirror, transforms.mirror]]) {
        sprite.position.set(transform.x, transform.y);
        sprite.rotation = transform.rotation;
        sprite.scale.set(transform.sx * g.w / texture.width, transform.sy * g.h / texture.height);
      }
      const horizontal = settings.axis === 'horizontal';
      leftMask.clear().rect(-4000, -4000, horizontal ? 8000 : 4000, horizontal ? 4000 : 8000).fill(0xffffff);
      rightMask.clear().rect(horizontal ? -4000 : 0, horizontal ? 0 : -4000, horizontal ? 8000 : 4000, horizontal ? 4000 : 8000).fill(0xffffff);
      if (helpers.guides) {
        const stroke = 1 / viewport.zoom;
        guides.moveTo(horizontal ? 0 : g.axisX, horizontal ? g.axisY : 0).lineTo(horizontal ? sw : g.axisX, horizontal ? g.axisY : sh).stroke({ color: 0xff5151, width: stroke });
        for (const [t, color] of [[transforms.source, 0xffdf45], [transforms.mirror, 0x429aff]]) {
          const corners = [[-1,-1], [1,-1], [1,1], [-1,1], [-1,-1]];
          corners.forEach(([x,y], i) => {
            const px = x * g.w / 2 * t.sx, py = y * g.h / 2 * t.sy;
            const wx = g.axisX + (t.x + px * Math.cos(t.rotation) - py * Math.sin(t.rotation)) * g.scale;
            const wy = g.axisY + (t.y + px * Math.sin(t.rotation) + py * Math.cos(t.rotation)) * g.scale;
            if (i) guides.lineTo(wx, wy); else guides.moveTo(wx, wy);
          });
          guides.stroke({ color, width: stroke });
        }
      }
    }
    app.render();
  }
  function tick(now) {
    if (disposed) return;
    if (viewport && viewport.resolution !== fit(element.clientWidth, element.clientHeight, settings.format, devicePixelRatio).resolution) resize();
    clock.step(now, !paused && !document.hidden && !!viewport?.zoom);
    if (!paused && !document.hidden && Object.values(settings.parameters).some(p => p.enabled)) draw();
    request = requestAnimationFrame(tick);
  }
  const visibility = () => { clock.last = null; };
  document.addEventListener('visibilitychange', visibility);
  const observer = new ResizeObserver(resize); observer.observe(element);
  resize(); request = requestAnimationFrame(tick);
  onStatus({ state: 'empty', message: 'Kies een afbeelding.' });
  return {
    clearAsset() {
      alive(); sequence++; cancelLoad?.(); cancelLoad = null;
      const previous = texture; texture = null;
      source.texture = Texture.EMPTY; mirror.texture = Texture.EMPTY;
      previous?.destroy(true); settings = { ...settings, assetRef: null };
      draw(); onStatus({ state: 'empty', message: 'Kies een afbeelding.' });
    },
    async setAsset({ source: input, reference = null }) {
      alive();
      if (reference !== null && (typeof reference !== 'string' || reference.length > 2048)) throw new Error('Ongeldige bronreferentie.');
      const id = ++sequence; cancelLoad?.();
      onStatus({ state: 'loading', message: 'Afbeelding laden…' });
      const url = input instanceof Blob ? URL.createObjectURL(input) : input;
      const image = new Image(); image.crossOrigin = 'anonymous';
      try {
        await new Promise((resolve, reject) => {
          cancelLoad = () => { image.src = ''; reject(new Error('Laden vervangen.')); };
          image.onload = resolve; image.onerror = () => reject(new Error('Afbeelding kon niet worden geladen. De vorige bron blijft behouden.'));
          image.src = url;
        });
        if (disposed || id !== sequence) return false;
        if (!image.naturalWidth || Math.max(image.naturalWidth, image.naturalHeight) > 8192) throw new Error('Afbeelding is leeg of groter dan 8192 pixels per zijde.');
        const next = Texture.from(image, true), previous = texture;
        texture = next; source.texture = next; mirror.texture = next;
        settings = { ...settings, assetRef: reference }; previous?.destroy(true);
        draw(); onChange(validate(settings));
        onStatus({ state: 'ready', message: `${image.naturalWidth} × ${image.naturalHeight} · ${reference || 'Afbeelding geladen'}` });
        return true;
      } catch (error) {
        if (!disposed && id === sequence) onStatus({ state: 'failed', message: error.message });
        return false;
      } finally {
        image.onload = image.onerror = null;
        if (input instanceof Blob) URL.revokeObjectURL(url);
        if (id === sequence) cancelLoad = null;
      }
    },
    loadSettings(value) { alive(); const next = validate(value); settings = next; resize(); onChange(validate(settings)); },
    getSettings() { alive(); return validate(settings); },
    setHelpers(value) { alive(); helpers = { ...helpers, ...value }; draw(); },
    pause() { alive(); paused = true; clock.last = null; },
    resume() { alive(); paused = false; clock.last = null; },
    isPaused() { return paused; },
    reset() { alive(); const ref = settings.assetRef; settings = defaults(); settings.assetRef = ref; clock.reset(); resize(); onChange(validate(settings)); },
    resize,
    destroy() {
      if (disposed) return;
      disposed = true; sequence++; cancelLoad?.(); cancelAnimationFrame(request);
      observer.disconnect(); document.removeEventListener('visibilitychange', visibility);
      // `true` also releases global Pixi pools in 8.17.1, harming sibling renderers.
      app.destroy({ removeView: true }, { children: true, texture: false, textureSource: false });
      texture?.destroy(true); texture = null;
    },
  };
}
