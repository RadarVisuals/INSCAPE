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
    uSourceRotation: { value: 0.0, type: 'f32' }
  }, false, true);

  const shader = new Shader({
    glProgram: mutationGlProgram,
    resources: {
      mutationUniforms,
      uMaskTexture: textures.mask.source,
      uLineartTexture: textures.lineart.source,
      uBaseTexture: textures.base.source,
      uPatternTexture: textures.pattern.source
    }
  });

  const mesh = new Mesh({
    geometry,
    shader,
    texture: Texture.WHITE
  });

  return { mesh, shader, geometry };
}
