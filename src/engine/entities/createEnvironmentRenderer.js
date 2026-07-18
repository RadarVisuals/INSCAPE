import { IllustratedStageEnvironment } from './IllustratedStageEnvironment.js';
import { createShaderEnvironment } from './ShaderEnvironmentRegistry.js';

export function createEnvironmentRenderer(sceneConfig, context) {
  if (sceneConfig?.environment?.type === 'shader') {
    const renderer = createShaderEnvironment(sceneConfig.environment.shaderId, context);
    if (renderer) return renderer;
  }
  return new IllustratedStageEnvironment(context);
}
