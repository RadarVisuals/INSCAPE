import {
  Mesh,
  MeshGeometry,
  Shader,
  Texture,
  UniformGroup,
  compileHighShaderGlProgram,
  localUniformBitGl,
  roundPixelsBitGl
} from 'pixi.js';
import { veinPulseOverlayBitGl } from '../shaders/VeinPulseShader.js';
import { captiveWeatherOverlayBitGl } from '../shaders/CaptiveWeatherShader.js';

const CHARACTER_SIZE = 2000;
const HALF_SIZE = CHARACTER_SIZE / 2;

const veinProgram = compileHighShaderGlProgram({
  name: 'vein-pulse-overlay',
  bits: [localUniformBitGl, roundPixelsBitGl, veinPulseOverlayBitGl]
});

const weatherProgram = compileHighShaderGlProgram({
  name: 'captive-weather-overlay',
  bits: [localUniformBitGl, roundPixelsBitGl, captiveWeatherOverlayBitGl]
});

function createGeometry() {
  return new MeshGeometry({
    positions: new Float32Array([
      -HALF_SIZE, -HALF_SIZE,
       HALF_SIZE, -HALF_SIZE,
       HALF_SIZE,  HALF_SIZE,
      -HALF_SIZE,  HALF_SIZE
    ]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3])
  });
}

export function createVeinPulseOverlay(maskTexture) {
  const uniforms = new UniformGroup({
    uVeinEnabled: { value: 1.0, type: 'f32' },
    uVeinTime: { value: 0.0, type: 'f32' },
    uVeinPulse: { value: 0.0, type: 'f32' },
    uVeinIntensity: { value: 0.35, type: 'f32' },
    uVeinScale: { value: 18.0, type: 'f32' },
    uVeinWidth: { value: 1.0, type: 'f32' },
    uVeinCore: { value: 1.25, type: 'f32' },
    uVeinColor: { value: [1.0, 0.08, 0.3], type: 'vec3<f32>' },
    uVeinSource: { value: [0.5, 0.58], type: 'vec2<f32>' }
  }, false, true);
  const geometry = createGeometry();
  const shader = new Shader({
    glProgram: veinProgram,
    resources: {
      veinUniforms: uniforms,
      uMaskTexture: maskTexture.source
    }
  });
  const mesh = new Mesh({ geometry, shader, texture: Texture.WHITE });
  mesh.label = 'actor_vein_overlay';
  return { mesh, shader, geometry };
}

export function createCaptiveWeatherOverlay(maskTexture) {
  const uniforms = new UniformGroup({
    uWeatherEnabled: { value: 1.0, type: 'f32' },
    uWeatherTime: { value: 0.0, type: 'f32' },
    uWeatherIntensity: { value: 0.28, type: 'f32' },
    uWeatherScale: { value: 2.2, type: 'f32' },
    uWeatherSpeed: { value: 0.55, type: 'f32' },
    uWeatherColor: { value: [0.16, 0.02, 0.28], type: 'vec3<f32>' }
  }, false, true);
  const geometry = createGeometry();
  const shader = new Shader({
    glProgram: weatherProgram,
    resources: {
      weatherUniforms: uniforms,
      uMaskTexture: maskTexture.source
    }
  });
  const mesh = new Mesh({ geometry, shader, texture: Texture.WHITE });
  mesh.label = 'actor_captive_weather_overlay';
  return { mesh, shader, geometry };
}
