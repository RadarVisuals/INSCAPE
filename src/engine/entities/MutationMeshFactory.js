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
    uNoiseScale: { value: 180.0, type: 'f32' }
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
