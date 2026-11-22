import { useEffect, useRef } from 'react';

const columns = 49, rows = 33;
const assets = '/assets/visitor/';

// The grid stores the four FigCraft tone channels (dark grey and light RGB) at
// 16 bits each. Interpolation and all three lights stay fractional until output.
const vertex = `
  attribute vec2 position;
  attribute vec4 tones;
  uniform vec2 viewport;
  uniform float seconds, lightTheme, distanceScale;
  uniform vec4 tint, glow, shade, fieldLow, fieldHigh;
  varying highp vec3 colour;
  float travel(float period, float phase) {
    return .5 - .5 * distanceScale * cos((seconds + phase) * 3.14159265 / period);
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
    colour = mix(tones.rrr, tones.gba, lightTheme);
    colour = mix(colour, tint.rgb, tint.a);
    if (fieldLow.a > 0.) {
      // The neutral reference mesh spans 18..52 in sRGB. Preserve its full relief
      // between the palette endpoints, matching the static field-range mask.
      float tone = clamp((tones.r * 255. - 18.) / 34., 0., 1.);
      colour = mix(fieldLow.rgb, fieldHigh.rgb, tone);
    }
    colour = mix(colour, glow.rgb, glow.a*pool(p,a));
    colour = mix(colour, glow.rgb, glow.a*pool(p,c));
    colour = mix(colour, shade.rgb, shade.a*pool(p,b));
    gl_Position = vec4((p/scale*2.-1.)*vec2(1.,-1.), 0., 1.);
  }`;
const fragment = `
  precision highp float;
  uniform sampler2D noiseTile;
  varying highp vec3 colour;
  void main() {
    float grain = (texture2D(noiseTile, gl_FragCoord.xy / 128.).r - .5) * (6.0/255.);
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
    const distance = gl.getUniformLocation(program, 'distanceScale');
    const tint = gl.getUniformLocation(program, 'tint'), glow = gl.getUniformLocation(program, 'glow'), shade = gl.getUniformLocation(program, 'shade');
    const low = gl.getUniformLocation(program, 'fieldLow'), high = gl.getUniformLocation(program, 'fieldHigh');
    return { release, configure(settings) {
      gl.uniform4fv(low, settings.low);
      gl.uniform4fv(high, settings.high);
      gl.uniform1f(theme, settings.light ? 1 : 0);
      gl.uniform1f(distance, settings.travel);
      gl.uniform4fv(tint, settings.tint);
      gl.uniform4fv(glow, settings.glow);
      gl.uniform4fv(shade, settings.shade);
    }, draw(width, height, seconds) {
      gl.viewport(0, 0, width, height);
      gl.uniform2f(viewport, width, height);
      gl.uniform1f(time, seconds);
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    }};
  } catch (error) { release(); throw error; }
}

// Resolve CSS colours in sRGB only when the palette changes.
function readFieldSettings(canvas, sample) {
  const style = getComputedStyle(canvas);
  const value = name => style.getPropertyValue('--field-' + name).trim();
  const number = (name, maximum) => Math.min(maximum, Math.max(0, Number(value(name)) || 0));
  const colour = (name, strength = 1) => {
    sample.fillStyle = 'transparent';
    sample.fillStyle = value(name) || 'transparent';
    sample.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = sample.getImageData(0, 0, 1, 1).data;
    return [r / 255, g / 255, b / 255, a / 255 * strength];
  };
  return { light: document.documentElement.dataset.interfaceTheme === 'light',
    speed: number('speed', Infinity), travel: number('travel', Infinity),
    low: colour('low'), high: colour('high'),
    tint: colour('tint'), glow: colour('glow', number('glow-strength', 1)),
    shade: colour('shade', number('shade-strength', 1)) };
}

// Only the background needs this context. Its static FigCraft image stays
// available during loading, on context loss, and on devices without WebGL.
export default function VisitorLightField({ paused = false }) {
  const ref = useRef(null), refresh = useRef(null), pausedRef = useRef(paused);
  useEffect(() => { pausedRef.current = paused; refresh.current?.(); }, [paused]);
  useEffect(() => {
    const canvas = ref.current, abort = new AbortController();
    const swatch = document.createElement('canvas');
    swatch.width = swatch.height = 1;
    const sample = swatch.getContext('2d', { willReadFrequently: true });
    if (!sample) return;
    sample.globalCompositeOperation = 'copy';
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const tile = new Image();
    tile.src = assets + 'output-dither.png';
    let tones, field, context, timer, last, seconds = 0;
    let settings = readFieldSettings(canvas, sample);
    function paint() {
      clearTimeout(timer);
      if (!field || document.hidden || pausedRef.current) { last = undefined; return; }
      const width = Math.max(1, Math.round(canvas.clientWidth * devicePixelRatio));
      const height = Math.max(1, Math.round(canvas.clientHeight * devicePixelRatio));
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;
      const now = performance.now();
      const animating = !motion.matches && settings.speed > 0 && settings.travel > 0;
      if (last !== undefined && animating) seconds += (now-last)/1000 * settings.speed;
      last = now;
      field.draw(width, height, seconds);
      canvas.dataset.ready = 'true';
      if (animating) timer = setTimeout(paint, 1000/24);
    }
    function start() {
      if (!tones || abort.signal.aborted) return;
      context = canvas.getContext('webgl', { alpha:false, antialias:false, depth:false, stencil:false, powerPreference:'low-power' });
      if (!context || context.isContextLost()) return;
      try { field = prepareField(context, tones, tile); field.configure(settings); paint(); }
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
    const palette = new MutationObserver(() => {
      settings = readFieldSettings(canvas, sample);
      field?.configure(settings);
      resetClock();
    });
    const paletteAttributes = { attributes: true, attributeFilter: ['data-interface-theme', 'data-palette', 'class', 'style'] };
    palette.observe(document.documentElement, paletteAttributes);
    palette.observe(canvas.parentElement, paletteAttributes);
    Promise.all([fetch(assets+'field-tones.bin', { signal:abort.signal }).then(response => {
      if (!response.ok) throw Error('Field unavailable');
      return response.arrayBuffer();
    }), tile.decode()]).then(([buffer]) => {
      tones = new Uint16Array(buffer);
      if (tones.length === columns*rows*4) start();
    }).catch(() => {});
    return () => {
      refresh.current = null;
      abort.abort(); observer.disconnect(); palette.disconnect(); clearTimeout(timer);
      field?.release();
      context?.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, []);
  return <canvas ref={ref} className="visitor-light-field" aria-hidden="true" />;
}
