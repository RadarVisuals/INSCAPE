import { Filter, UniformGroup, defaultFilterVert } from 'pixi.js';
import { SHED_SKIN_TRAIL_FRAGMENT_SHADER } from '../shaders/ShedSkinTrailShader.js';

export function createShedSkinTrailFilter() {
  const uniforms = new UniformGroup({
    uProgress: { value: 0.0, type: 'f32' },
    uTime: { value: 0.0, type: 'f32' },
    uDissolve: { value: 0.8, type: 'f32' },
    uDirection: { value: [1.0, 0.0], type: 'vec2<f32>' },
    uTint: { value: [1.0, 0.08, 0.58], type: 'vec3<f32>' },
    uTintStrength: { value: 0.58, type: 'f32' }
  }, false, true);

  const filter = Filter.from({
    gl: {
      vertex: defaultFilterVert,
      fragment: SHED_SKIN_TRAIL_FRAGMENT_SHADER
    },
    resources: { shedSkinUniforms: uniforms }
  });
  filter.padding = 36;
  return filter;
}
