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
import { mutationMeshBitGl } from '../shaders/MutationMeshShader.js';

const WORKSPACE_HALF_SIZE = 3000;

const mutationGlProgram = compileHighShaderGlProgram({
  name: 'creator-mutation-mesh',
  bits: [localUniformBitGl, roundPixelsBitGl, mutationMeshBitGl]
});

export function createMutationMesh(textures) {
  const geometry = new MeshGeometry({
    positions: new Float32Array([
      -WORKSPACE_HALF_SIZE, -WORKSPACE_HALF_SIZE,
       WORKSPACE_HALF_SIZE, -WORKSPACE_HALF_SIZE,
       WORKSPACE_HALF_SIZE,  WORKSPACE_HALF_SIZE,
      -WORKSPACE_HALF_SIZE,  WORKSPACE_HALF_SIZE
    ]),
    uvs: new Float32Array([
      0, 0,
      1, 0,
      1, 1,
      0, 1
    ]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3])
  });

  const mutationUniforms = new UniformGroup({
    uMode: { value: 0.0, type: 'f32' },
    uAxisX: { value: 0.5, type: 'f32' },
    uAxisY: { value: 0.5, type: 'f32' },
    uSourceX: { value: 0.0, type: 'f32' },
    uSourceY: { value: 0.0, type: 'f32' },
    uMirrorPattern: { value: 0.0, type: 'f32' },
    uSourceRotation: { value: 0.0, type: 'f32' },
    uTime: { value: 0.0, type: 'f32' },
    uWarpIntensity: { value: 20.0, type: 'f32' },
    uWarpMode: { value: 0.0, type: 'f32' },
    uMorphRange: { value: 1.0, type: 'f32' },
    uLayerDivergence: { value: 0.3, type: 'f32' },
    uCursorPosition: { value: [0.5, 0.5], type: 'vec2<f32>' },
    uCursorVelocity: { value: [0.0, 0.0], type: 'vec2<f32>' },
    uCursorActive: { value: 0.0, type: 'f32' },
    uCursorInfluence: { value: 0.45, type: 'f32' },
    uCursorRadius: { value: 0.22, type: 'f32' },
    uBaseGradientMode: { value: 0.0, type: 'f32' },
    uBaseGradientAngle: { value: 0.0, type: 'f32' },
    uBaseGradientBalance: { value: 0.5, type: 'f32' },
    uBaseOpacity: { value: 1.0, type: 'f32' },
    uPattern1GradientMode: { value: 0.0, type: 'f32' },
    uPattern1GradientAngle: { value: 0.0, type: 'f32' },
    uPattern1GradientBalance: { value: 0.5, type: 'f32' },
    uPattern1Opacity: { value: 1.0, type: 'f32' },
    uPattern1Scale: { value: 1.0, type: 'f32' },
    uPattern2GradientMode: { value: 0.0, type: 'f32' },
    uPattern2GradientAngle: { value: 0.0, type: 'f32' },
    uPattern2GradientBalance: { value: 0.5, type: 'f32' },
    uPattern2Opacity: { value: 0.0, type: 'f32' },
    uPattern2Scale: { value: 1.0, type: 'f32' },
    uNoiseIntensity: { value: 0.0, type: 'f32' },
    uNoiseScale: { value: 180.0, type: 'f32' },
    uVeinEnabled: { value: 1.0, type: 'f32' },
    uVeinTime: { value: 0.0, type: 'f32' },
    uVeinPulse: { value: 0.0, type: 'f32' },
    uVeinIntensity: { value: 0.35, type: 'f32' },
    uVeinScale: { value: 18.0, type: 'f32' },
    uVeinWidth: { value: 1.0, type: 'f32' },
    uVeinCore: { value: 1.25, type: 'f32' },
    uVeinColor: { value: [1.0, 0.08, 0.3], type: 'vec3<f32>' },
    uVeinSource: { value: [0.5, 0.58], type: 'vec2<f32>' },
    uWeatherEnabled: { value: 1.0, type: 'f32' },
    uWeatherTime: { value: 0.0, type: 'f32' },
    uWeatherIntensity: { value: 0.28, type: 'f32' },
    uWeatherScale: { value: 2.2, type: 'f32' },
    uWeatherSpeed: { value: 0.55, type: 'f32' },
    uWeatherColor: { value: [0.16, 0.02, 0.28], type: 'vec3<f32>' },
    uTransfusionEnabled: { value: 1.0, type: 'f32' },
    uTransfusionTime: { value: 0.0, type: 'f32' },
    uTransfusionIntensity: { value: 0.78, type: 'f32' },
    uTransfusionScale: { value: 3.4, type: 'f32' },
    uTransfusionBalance: { value: 0.5, type: 'f32' },
    uTransfusionEdge: { value: 0.38, type: 'f32' }
  }, false, true);

  const shader = new Shader({
    glProgram: mutationGlProgram,
    resources: {
      mutationUniforms,
      uMaskTexture: textures.mask.source,
      uLineartTexture: textures.lineart.source,
      uPattern1Texture: textures.pattern1.source,
      uPattern2Texture: textures.pattern2.source,
      uBasePaletteA: textures.baseA.source,
      uBasePaletteB: textures.baseB.source,
      uPattern1PaletteA: textures.pattern1A.source,
      uPattern1PaletteB: textures.pattern1B.source,
      uPattern2PaletteA: textures.pattern2A.source,
      uPattern2PaletteB: textures.pattern2B.source
    }
  });

  const mesh = new Mesh({
    geometry,
    shader,
    texture: Texture.WHITE
  });

  return { mesh, shader, geometry };
}
