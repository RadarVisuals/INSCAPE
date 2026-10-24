// Decorative comparison: baked cloth, original live flight. A stopped image uses its poster.
class ClothRenderer {
  constructor(canvas) {
    this.canvas = canvas; canvas.width = canvas.height = 0; canvas.style.display = 'none';
    this.available = true; this.uploads = 0; this.draws = 0; this.layers = [];
    this.perfGpu = { renderer: 'animated WebP in SVG', vendor: 'browser', antialias: true, timerQuery: false };
    this.root = document.createElementNS('http://www.w3.org/2000/svg', 'g'); this.root.id = 'nomad-loop';
    this.root.style.pointerEvents = 'none'; svgRoot.insertBefore(this.root, svgRuntime);
    this.active = false;
  }
  load() {
    this.image = svgPoster.querySelector('image').cloneNode(true); this.root.append(this.image);
    this.poster = this.image.getAttribute('href'); this.loop = NOMAD_LOOP_DATA;
    this.layers = [this.image];
  }
  setActive(active) {
    if (!this.image || active === this.active) return;
    this.active = active; this.image.setAttribute('href', active ? this.loop : this.poster);
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
    this.draws = 1;
  }
  dispose() { this.setActive(false); this.root.remove(); this.layers = []; this.available = false; }
}
