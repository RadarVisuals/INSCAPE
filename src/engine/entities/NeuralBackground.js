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
import { neuralBackgroundBitGl } from '../shaders/NeuralBackgroundShader.js';

const neuralBackgroundProgram = compileHighShaderGlProgram({
  name: 'neural-background',
  bits: [localUniformBitGl, roundPixelsBitGl, neuralBackgroundBitGl]
});

function createGeometry() {
  return new MeshGeometry({
    positions: new Float32Array([
      -0.5, -0.5,
       0.5, -0.5,
       0.5,  0.5,
      -0.5,  0.5
    ]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3])
  });
}

export class NeuralBackground {
  constructor(initialSize = 1200) {
    this.width = initialSize;
    this.height = initialSize;
    this.scroll = 0;
    this.elapsedSeconds = 0;
    this.destroyed = false;
    this.uniforms = new UniformGroup({
      uNeuralTime: { value: 0.0, type: 'f32' },
      uNeuralAspect: { value: 1.0, type: 'f32' },
      uNeuralScroll: { value: 0.0, type: 'f32' },
      uNeuralActor: { value: [0.5, 0.5], type: 'vec2<f32>' },
      uNeuralActorActive: { value: 0.0, type: 'f32' }
    }, false, true);
    this.geometry = createGeometry();
    this.shader = new Shader({
      glProgram: neuralBackgroundProgram,
      resources: { neuralBackgroundUniforms: this.uniforms }
    });
    this.mesh = new Mesh({
      geometry: this.geometry,
      shader: this.shader,
      texture: Texture.WHITE
    });
    this.mesh.label = 'stage_neural_background';
    this.resize(initialSize, initialSize);
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.mesh.scale.set(this.width, this.height);
    this.uniforms.uniforms.uNeuralAspect = this.width / this.height;
  }

  update(deltaTime, sceneConfig, runtime) {
    const dtSeconds = deltaTime / 60;
    this.elapsedSeconds += dtSeconds;
    const scrollSpeed = sceneConfig.background.scrollSpeed;
    this.scroll -= (scrollSpeed * dtSeconds) / Math.max(this.width, 1);

    const uniforms = this.uniforms.uniforms;
    uniforms.uNeuralTime = this.elapsedSeconds;
    uniforms.uNeuralScroll = this.scroll;

    if (runtime.actorAvailable && runtime.actorPosition) {
      uniforms.uNeuralActor = [
        0.5 + runtime.actorPosition.x / this.width,
        0.5 + runtime.actorPosition.y / this.height
      ];
      uniforms.uNeuralActorActive = 1.0;
    } else {
      uniforms.uNeuralActorActive = 0.0;
    }
  }

  getEffectsTargets() {
    return { mountainReflector: null, mountainBackReflector: null, ceilingReflector: null };
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.mesh.parent) this.mesh.parent.removeChild(this.mesh);
    const geometry = this.geometry;
    const shader = this.shader;
    this.mesh.destroy({ texture: false, textureSource: false });
    geometry.destroy(true);
    shader.destroy(false);
    this.mesh = null;
    this.geometry = null;
    this.shader = null;
    this.uniforms = null;
  }
}
