// Local measurements only. Keep the supplied artwork byte-for-byte intact on disk.
// The trial caps drawing, not the flight clock or its existing spring simulation.
export function nomadStudy(source, { fps = 0, active = true, oversample = 1.5, probe = true, startupProbe = false } = {}) {
  const replace = (before, after) => {
    if (source.split(before).length !== 2) throw new Error('Nomad source changed: ' + before.slice(0, 80));
    source = source.replace(before, after);
  };
  replace("let mode = 'hover'", "let mode = 'fly'");
  if (!active) replace('running = !reduced.matches', 'running = false');
  if (oversample !== 1.5) replace('requested * 1.5', 'requested * ' + Number(oversample));
  if (fps) {
    replace('let status = \'loading\';', `let nextPaint = 0; const paintInterval = ${1000 / fps};\nlet status = 'loading';`);
    replace('frame = 0; last = 0;', 'frame = 0; last = 0; nextPaint = 0;');
    replace('motion.step(dt, target); draw(); frame = requestAnimationFrame(tick);',
      `motion.step(dt, target);
  if (!nextPaint || now + .1 >= nextPaint) {
    draw();
    nextPaint = nextPaint ? nextPaint + (Math.floor(Math.max(0, now - nextPaint) / paintInterval) + 1) * paintInterval : now + paintInterval;
  }
  frame = requestAnimationFrame(tick);`);
  }
  if (probe) {
    replace('let hostPixelScale = null;', `let hostPixelScale = null;
const perf = { callbacks: 0, paints: 0, drawMs: 0, stamps: [], textures: [], resizes: 0, allocations: 0 };
window.nomadPerf = {
  snapshot() { return { ...perf, now: performance.now(), status, running, hostVisible, pageActive, disposed,
    state: state(), mode, logical: [renderer?.width, renderer?.height], density: hostPixelScale,
    buffer: [renderer?.canvas.width, renderer?.canvas.height], layers: renderer?.layers.length,
    uploads: renderer?.uploads, draws: renderer?.draws, gpu: renderer?.perfGpu,
    posterVisible: getComputedStyle(svgPoster).display !== 'none' }; },
  run: setRunning, mode: setMode,
  pose(value) { setRunning(false); Object.assign(motion, value); draw(); },
  capture() { draw(); return renderer.canvas.toDataURL('image/png'); },
  async gpuSamples(count = 40) {
    setRunning(false); const gl = renderer.gl, ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!ext) return null;
    const samples = []; const next = () => new Promise(requestAnimationFrame);
    for (let i = 0; i < count; i++) {
      await next(); const q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); draw(); gl.endQuery(ext.TIME_ELAPSED_EXT);
      for (let tries = 0; !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE); tries++) {
        if (tries > 120) throw new Error('GPU timing unavailable'); await next();
      }
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) samples.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(q);
    }
    return samples;
  },
  loseContext() { renderer.gl.getExtension('WEBGL_lose_context').loseContext(); },
  simulate(times) { const test = new FlightMotion(); let previous = 0;
    for (const now of times) { const dt = previous ? Math.min((now - previous) / 1000, .1) : 0; previous = now;
      test.step(dt, { x: Math.sin(test.time * .55) * 245, y: Math.sin(test.time * .8) * 55 }); }
    return { ...test }; }
};`);
    replace('function tick(now) {', 'function tick(now) {\n  perf.callbacks++;');
    replace('renderer?.draw(state());', `const start = performance.now(); renderer?.draw(state());
  perf.paints++; perf.drawMs += performance.now() - start;
  perf.stamps.push(start); if (perf.stamps.length > 600) perf.stamps.shift();`);
    replace('this.width = width; this.height = height;', 'perf.resizes++; this.width = width; this.height = height;');
    replace('if (this.canvas.width !== w)', 'if (this.canvas.width !== w || this.canvas.height !== h) perf.allocations++;\n    if (this.canvas.width !== w)');
    replace('const gl = this.gl, data = mesh(asset.box), tex = gl.createTexture();', `const gl = this.gl, data = mesh(asset.box), tex = gl.createTexture();
      perf.textures.push({ id: part.id, pass, width: asset.image.naturalWidth, height: asset.image.naturalHeight,
        vertices: data.original.length / 4, triangles: data.indices.length / 3 });`);
    replace('this.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);', `const info = gl.getExtension('WEBGL_debug_renderer_info');
    this.perfGpu = { renderer: info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL),
      vendor: info && gl.getParameter(info.UNMASKED_VENDOR_WEBGL), antialias: gl.getContextAttributes().antialias,
      timerQuery: Boolean(gl.getExtension('EXT_disjoint_timer_query_webgl2')) };
    this.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);`);
  }
  if (startupProbe) {
    replace('let hostPixelScale = null;', `let hostPixelScale = null;
const startupMeasure = (name, start, detail = {}) => {
  const duration = performance.now() - start;
  performance.measure('nomad-' + name, { start, duration });
  top.postMessage({ type: 'inscape:perf-nomad-startup', name, start: performance.timeOrigin + start,
    duration, document: location.href, ...detail }, '*');
};`);
    replace('const image = new Image(); image.src=layer.source;',
      'const decodeStart = performance.now(); const image = new Image(); image.src=layer.source;');
    replace('const asset={...layer,image};',
      "startupMeasure('decode', decodeStart, { id: layer.id, pass: layer.pass }); const asset={...layer,image};");
    replace('const gl = this.gl, data = mesh(asset.box), tex = gl.createTexture();',
      'const uploadStart = performance.now(); const gl = this.gl, data = mesh(asset.box), tex = gl.createTexture();');
    replace('asset.image.width = asset.image.height = 1;',
      "startupMeasure('upload', uploadStart, { id: part.id, pass }); asset.image.width = asset.image.height = 1;");
    const load = source.includes('await renderer.load(prepared);') ? 'await renderer.load(prepared);' : 'renderer.load(prepared);';
    replace(load, "const loadStart = performance.now(); " + load + " startupMeasure('load', loadStart);");
    replace('renderer.resize(stage.clientWidth, stage.clientHeight, hostPixelScale ?? (devicePixelRatio || 1)); draw();',
      "const resizeStart = performance.now(); renderer.resize(stage.clientWidth, stage.clientHeight, hostPixelScale ?? (devicePixelRatio || 1)); draw(); startupMeasure('resize-and-draw', resizeStart, { status, density: hostPixelScale });");
  }
  return source;
}
