// Experimental vector implementation of the existing Nomad rig; no raster canvas.
class ClothRenderer {
  constructor(canvas) {
    this.canvas = canvas; canvas.width = canvas.height = 0; canvas.style.display = 'none';
    this.available = true; this.uploads = 0; this.draws = 0; this.layers = [];
    this.perfGpu = { renderer: 'SVG paths', vendor: 'browser', antialias: true, timerQuery: false };
    this.root = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.root.id = 'nomad-vector'; this.root.style.pointerEvents = 'none';
    svgRoot.insertBefore(this.root, svgRuntime);
  }
  load() {
    for (const source of svgPoster.children) {
      const group = source.cloneNode(true); group.removeAttribute('id'); this.root.append(group);
      const rig = RIG[group.dataset.part];
      for (const path of group.querySelectorAll('path')) {
        const tokens = path.getAttribute('d').match(/[MLCZ]|[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi);
        const points = [];
        for (let i = 0; i < tokens.length;) {
          if (/^[MLCZ]$/i.test(tokens[i])) { i++; continue; }
          const x = Number(tokens[i]), y = Number(tokens[i + 1]);
          let u = 0, weight = 0;
          if (rig) {
            const dx = rig.tip[0] - rig.root[0], dy = rig.tip[1] - rig.root[1];
            u = clamp(((x - rig.root[0]) * dx + (y - rig.root[1]) * dy) / (dx * dx + dy * dy), 0, 1);
            weight = smooth((u - .12) / .88);
            if (rig.pin) weight *= smooth((Math.hypot(x - rig.pin[0], y - rig.pin[1]) - rig.pin[2] * .35) / (rig.pin[2] * .65));
          }
          points.push({ index: i, x, y, u, weight }); i += 2;
        }
        this.layers.push({ path, rig, tokens, points });
      }
    }
  }
  resize(width, height, density) {
    this.width = width; this.height = height;
    if (typeof perf !== 'undefined') perf.resizes++;
  }
  draw(state) {
    if (!this.available) return;
    const angle = state.rest ? 0 : state.speed * .025 + Math.sin(state.time * .7) * .003;
    const bob = state.rest ? 0 : Math.sin(state.time * 1.25) * 9;
    const x = state.rest ? 0 : state.x || 0, y = state.rest ? 0 : state.y || 0;
    this.root.setAttribute('transform', `translate(${this.width / 2} ${this.height / 2}) scale(${fitScale(this.width, this.height) * (state.zoom || 1)}) translate(${-1125 + x} ${-985 + y + bob}) translate(1030 800) rotate(${angle * 180 / Math.PI}) translate(-1030 -800)`);
    const wind = clamp(state.wind, 0, 1), speed = clamp(state.speed, -1, 1), t = state.time;
    const strength = .23 + wind * .65 + Math.abs(speed) * .7;
    for (const layer of this.layers) {
      if (!layer.rig) continue;
      const { rig, tokens, points } = layer;
      for (const p of points) {
        const flutter = Math.sin(t * 2.2 - p.u * 3.6 + rig.phase) * .72 + Math.sin(t * 3.7 - p.u * 5.1 + rig.phase * .6) * .28;
        const bend = state.rest ? 0 : (-speed * .9 - wind * .3 + flutter * strength) * rig.amount * p.weight;
        const lift = state.rest ? 0 : Math.cos(t * 2.2 - p.u * 3.6 + rig.phase) * rig.amount * p.weight * strength * .16;
        tokens[p.index] = String(Math.round((p.x + bend) * 1000) / 1000);
        tokens[p.index + 1] = String(Math.round((p.y + lift) * 1000) / 1000);
      }
      layer.path.setAttribute('d', tokens.join(' '));
    }
    this.draws = this.layers.length;
  }
  dispose() { this.root.remove(); this.layers = []; this.available = false; }
}
