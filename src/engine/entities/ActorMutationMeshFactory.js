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
import {
  ACTOR_MUTATION_FRAGMENT_HEADER,
  ACTOR_MUTATION_FRAGMENT_MAIN
} from '../shaders/MutationGeometryShader.js';

const actorMutationBitGl = {
  name: 'authored-actor-mutation-mesh',
  fragment: {
    header: ACTOR_MUTATION_FRAGMENT_HEADER,
    main: ACTOR_MUTATION_FRAGMENT_MAIN
  }
};

const actorMutationProgram = compileHighShaderGlProgram({
  name: 'authored-actor-mutation-mesh',
  bits: [localUniformBitGl, roundPixelsBitGl, actorMutationBitGl]
});

export function createActorMutationMesh(sourceTexture, sourceWidth, sourceHeight) {
  const halfWidth = sourceWidth * 1.5;
  const halfHeight = sourceHeight * 1.5;
  const geometry = new MeshGeometry({
    positions: new Float32Array([
      -halfWidth, -halfHeight,
       halfWidth, -halfHeight,
       halfWidth,  halfHeight,
      -halfWidth,  halfHeight
    ]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3])
  });

  const mutationUniforms = new UniformGroup({
    uMode: { value: 0.0, type: 'f32' },
    uAxisX: { value: 0.5, type: 'f32' },
    uAxisY: { value: 0.5, type: 'f32' },
    uSourceX: { value: 0.0, type: 'f32' },
    uSourceY: { value: 0.0, type: 'f32' },
    uSourceRotation: { value: 0.0, type: 'f32' }
  }, false, true);

  const shader = new Shader({
    glProgram: actorMutationProgram,
    resources: {
      mutationUniforms,
      uSourceTexture: sourceTexture.source
    }
  });
  const mesh = new Mesh({ geometry, shader, texture: Texture.WHITE });
  return { mesh, shader, geometry };
}
