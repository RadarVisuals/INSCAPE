import { NeuralBackground } from './NeuralBackground.js';

export const SHADER_ENVIRONMENT_IDS = Object.freeze(['neural-field']);
const shaderFactories = Object.freeze({
  'neural-field': ({ bgContainer, bgHeightScale }) => {
    const implementation = new NeuralBackground(bgHeightScale);
    bgContainer.addChild(implementation.mesh);
    return implementation;
  }
});

export const isKnownShaderEnvironmentId = (shaderId) => Object.hasOwn(shaderFactories, shaderId);
export const createShaderEnvironment = (shaderId, context) => shaderFactories[shaderId]?.(context) || null;
