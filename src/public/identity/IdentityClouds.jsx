import { useEffect, useRef, useState } from 'react';

const vertex = `attribute vec2 position; void main(){gl_Position=vec4(position,0.,1.);}`;
const fragment = `
precision mediump float;
uniform vec2 resolution;
uniform float time;
uniform vec3 baseColor;
uniform vec3 cloudColor;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);
}
float fbm(vec2 p){
  float n=0., a=.5;
  for(int i=0;i<5;i++){n+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+7.1;a*=.5;}
  return n;
}
void main(){
  vec2 p=gl_FragCoord.xy/resolution.y*3.;
  vec2 drift=vec2(time*.025,time*.009);
  vec2 warp=vec2(fbm(p+drift),fbm(p+vec2(4.3,1.2)-drift*.6));
  float cloud=fbm(p+warp*2.4+drift);
  float density=smoothstep(.25,.8,cloud);
  gl_FragColor=vec4(mix(baseColor,cloudColor,density*.42),1.);
}`;

// Bounded, module-owned renderer. No profile, wallet, or Workbench dependencies.
export default function IdentityClouds({ surface, color = null, speed = 1 }) {
  const ref = useRef(null);
  const settings = useRef({ color, speed });
  settings.current = { color, speed };
  const refreshRef = useRef(null);
  useEffect(() => { refreshRef.current?.(); }, [color, speed]);
  const [contextRevision, setContextRevision] = useState(0);
  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, powerPreference: 'low-power' });
    if (!gl) return undefined;
    const shaders = [];
    const compile = (type, source) => {
      const shader = gl.createShader(type); shaders.push(shader);
      gl.shaderSource(shader, source); gl.compileShader(shader);
      return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
    };
    const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
    const program = gl.createProgram();
    if (vs && fs) { gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program); }
    if (!vs || !fs || !gl.getProgramParameter(program, gl.LINK_STATUS)) {
      shaders.forEach(shader => gl.deleteShader(shader)); gl.deleteProgram(program); return undefined;
    }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    gl.useProgram(program);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const resolution = gl.getUniformLocation(program, 'resolution'), time = gl.getUniformLocation(program, 'time');
    // Resolve the existing surface/ink tokens, including CSS color-mix values.
    const swatch = document.createElement('canvas').getContext('2d');
    const rgb = (color) => {
      swatch.fillStyle = color; swatch.fillRect(0, 0, 1, 1);
      return Array.from(swatch.getImageData(0, 0, 1, 1).data).slice(0, 3).map(value => value / 255);
    };
    const style = getComputedStyle(canvas);
    gl.uniform3fv(gl.getUniformLocation(program, 'baseColor'), rgb(style.backgroundColor));
    const cloudUniform = gl.getUniformLocation(program, 'cloudColor');
    const themeCloud = rgb(style.color);
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, visible = true, lost = false, elapsed = 0, previous = 0;
    const draw = (now) => {
      frame = 0;
      if (lost || !visible || document.hidden) { previous = 0; return; }
      if (previous && !motion.matches) elapsed += Math.min(now - previous, 100) / 1000 * settings.current.speed;
      previous = now;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(resolution, canvas.width, canvas.height); gl.uniform1f(time, elapsed);
      gl.uniform3fv(cloudUniform, settings.current.color
        ? [1, 3, 5].map(start => parseInt(settings.current.color.slice(start, start + 2), 16) / 255) : themeCloud);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      canvas.dataset.shader = 'ready';
      if (!motion.matches && settings.current.speed > 0) frame = requestAnimationFrame(draw);
    };
    const refresh = () => { cancelAnimationFrame(frame); previous = 0; frame = requestAnimationFrame(draw); };
    refreshRef.current = refresh;
    const resize = new ResizeObserver(() => {
      // Soft clouds need no device-pixel scaling; cap GPU work for large windows.
      const bounds = canvas.getBoundingClientRect();
      const scale = Math.min(1, 640 / Math.max(bounds.width, bounds.height, 1));
      canvas.width = Math.max(1, Math.round(bounds.width * scale));
      canvas.height = Math.max(1, Math.round(bounds.height * scale)); refresh();
    });
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; refresh(); });
    const contextLost = (event) => { event.preventDefault(); lost = true; cancelAnimationFrame(frame); delete canvas.dataset.shader; };
    const contextRestored = () => setContextRevision(value => value + 1);
    resize.observe(canvas); observer.observe(canvas);
    document.addEventListener('visibilitychange', refresh); motion.addEventListener('change', refresh);
    canvas.addEventListener('webglcontextlost', contextLost);
    canvas.addEventListener('webglcontextrestored', contextRestored);
    refresh();
    return () => {
      refreshRef.current = null;
      cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect();
      document.removeEventListener('visibilitychange', refresh); motion.removeEventListener('change', refresh);
      canvas.removeEventListener('webglcontextlost', contextLost);
      canvas.removeEventListener('webglcontextrestored', contextRestored);
      gl.deleteBuffer(buffer); gl.deleteProgram(program); shaders.forEach(shader => gl.deleteShader(shader));
    };
  }, [contextRevision, surface]);
  return <canvas ref={ref} className="identity-module__clouds" aria-hidden="true" />;
}
