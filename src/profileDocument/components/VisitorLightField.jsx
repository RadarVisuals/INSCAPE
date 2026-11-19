import { useEffect, useRef } from 'react';
import { interfaceTheme } from '../../interfaceTheme.js';

const columns = 49, rows = 33;
const assets = '/assets/visitor/';

// The grid stores the four FigCraft tone channels (dark grey and light RGB) at
// 16 bits each. Interpolation and all three lights stay fractional until output.
const vertex = `
  attribute vec2 position;
  attribute vec4 tones;
  uniform vec2 viewport;
  uniform float seconds, lightTheme;
  varying highp vec3 colour;
  float travel(float period, float phase) {
    return .5 - .5 * cos((seconds + phase) * 3.14159265 / period);
  }
  float pool(vec2 p, vec2 centre) {
    return 1. - smoothstep(0., 1., length((p-centre)/vec2(.46,.38)));
  }
  void main() {
    vec2 scale = viewport / max(viewport.x, viewport.y);
    vec2 image = vec2(1.48148, 1.);
    vec2 cover = image * max(scale.x / image.x, scale.y / image.y);
    vec2 p = (position-.5) * cover + .5 * scale;
    vec2 a = vec2(.18,.15) + vec2(.34,.19)*scale*travel(43.,11.);
    vec2 b = vec2(.46,.38) + vec2(.22,.03)*scale - vec2(.40,.32)*scale*travel(61.,34.);
    vec2 c = vec2(scale.x-.10,.10) + vec2(-.31,.42)*scale*travel(53.,24.);
    vec3 glow = mix(vec3(191.,190.,181.), vec3(249.,239.,218.), lightTheme)/255.;
    vec3 shade = lightTheme * vec3(57.,61.,57.)/255.;
    colour = mix(tones.rrr, tones.gba, lightTheme);
    float strength = mix(.11,.27,lightTheme);
    colour = mix(colour, glow, strength*pool(p,a));
    colour = mix(colour, glow, strength*pool(p,c));
    colour = mix(colour, shade, mix(.30,.18,lightTheme)*pool(p,b));
    gl_Position = vec4((p/scale*2.-1.)*vec2(1.,-1.), 0., 1.);
  }`;
const fragment = `
  precision highp float;
  uniform sampler2D noiseTile;
  varying highp vec3 colour;
  void main() {
    float grain = (texture2D(noiseTile, gl_FragCoord.xy / 128.).r - .5) * (3.0/255.);
    gl_FragColor = vec4(colour + grain, 1.);
  }`;

function prepareField(gl, tones, tile) {
  const program = gl.createProgram(), texture = gl.createTexture();
  const positions = gl.createBuffer(), colours = gl.createBuffer(), triangles = gl.createBuffer();
  const release = () => {
    [positions, colours, triangles].forEach(buffer => gl.deleteBuffer(buffer));
    gl.deleteTexture(texture);
    gl.deleteProgram(program);
  };
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
      const shader = gl.createShader(type);
      try {
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
        gl.attachShader(program, shader);
      } finally { gl.deleteShader(shader); }
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const points = [], indices = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        points.push(x/(columns-1), y/(rows-1));
        if (x+1 === columns || y+1 === rows) continue;
        const i = y*columns+x;
        indices.push(i, i+1, i+columns, i+columns, i+1, i+columns+1);
      }
    }
    for (const [name, buffer, data, size, type] of [
      ['position', positions, new Float32Array(points), 2, gl.FLOAT],
      ['tones', colours, tones, 4, gl.UNSIGNED_SHORT],
    ]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const location = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, type, name === 'tones', 0, 0);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangles);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    gl.disable(gl.DITHER);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tile);
    const viewport = gl.getUniformLocation(program, 'viewport');
    const time = gl.getUniformLocation(program, 'seconds'), theme = gl.getUniformLocation(program, 'lightTheme');
    return { release, draw(width, height, seconds, light) {
      gl.viewport(0, 0, width, height);
      gl.uniform2f(viewport, width, height);
      gl.uniform1f(time, seconds);
      gl.uniform1f(theme, light ? 1 : 0);
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    }};
  } catch (error) { release(); throw error; }
}

// Only the background needs this context. Its static FigCraft image stays
// available during loading, on context loss, and on devices without WebGL.
export default function VisitorLightField({ paused = false }) {
  const ref = useRef(null), refresh = useRef(null), pausedRef = useRef(paused);
  useEffect(() => { pausedRef.current = paused; refresh.current?.(); }, [paused]);
  useEffect(() => {
    const canvas = ref.current, abort = new AbortController();
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const tile = new Image();
    tile.src = assets + 'output-dither.png';
    let tones, field, context, timer, last, seconds = 0;
    function paint() {
      clearTimeout(timer);
      if (!field || document.hidden || pausedRef.current) { last = undefined; return; }
      const width = Math.max(1, Math.round(canvas.clientWidth * devicePixelRatio));
      const height = Math.max(1, Math.round(canvas.clientHeight * devicePixelRatio));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      const now = performance.now();
      if (last !== undefined && !motion.matches) seconds += (now-last)/1000;
      last = now;
      field.draw(width, height, seconds, interfaceTheme.getSnapshot().mode === 'light');
      canvas.dataset.ready = 'true';
      if (!motion.matches) timer = setTimeout(paint, 1000/24);
    }
    function start() {
      if (!tones || abort.signal.aborted) return;
      context = canvas.getContext('webgl', { alpha:false, antialias:false, depth:false, stencil:false, powerPreference:'low-power' });
      if (!context || context.isContextLost()) return;
      try { field = prepareField(context, tones, tile); paint(); }
      catch { delete canvas.dataset.ready; }
    }
    const events = { signal:abort.signal };
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      clearTimeout(timer); field = null; last = undefined; delete canvas.dataset.ready;
    }, events);
    canvas.addEventListener('webglcontextrestored', start, events);
    const resetClock = () => { last = undefined; paint(); };
    refresh.current = resetClock;
    motion.addEventListener('change', resetClock, events);
    document.addEventListener('visibilitychange', resetClock, events);
    window.addEventListener('resize', paint, events);
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    const unsubscribe = interfaceTheme.subscribe(paint);
    Promise.all([fetch(assets+'field-tones.bin', { signal:abort.signal }).then(response => {
      if (!response.ok) throw Error('Field unavailable');
      return response.arrayBuffer();
    }), tile.decode()]).then(([buffer]) => {
      tones = new Uint16Array(buffer);
      if (tones.length === columns*rows*4) start();
    }).catch(() => {});
    return () => {
      refresh.current = null;
      abort.abort(); observer.disconnect(); unsubscribe(); clearTimeout(timer);
      field?.release();
      context?.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);
  return <canvas ref={ref} className="visitor-light-field" aria-hidden="true" />;
}
