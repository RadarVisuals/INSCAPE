export const neuralBackgroundBitGl = {
  name: 'neural-background',
  fragment: {
    header: `
      precision highp float;

      uniform float uNeuralTime;
      uniform float uNeuralAspect;
      uniform float uNeuralScroll;
      uniform vec2 uNeuralActor;
      uniform float uNeuralActorActive;

      mat2 neuralRotation(float angle) {
        float sine = sin(angle);
        float cosine = cos(angle);
        return mat2(cosine, sine, -sine, cosine);
      }

      float neuralShape(vec2 uv, float time, float pointerInfluence) {
        vec2 sineAccumulator = vec2(0.0);
        vec2 result = vec2(0.0);
        float scale = 8.4;
        mat2 rotation = neuralRotation(1.0);

        for (int layerIndex = 0; layerIndex < 12; layerIndex++) {
          uv = rotation * uv;
          sineAccumulator = rotation * sineAccumulator;
          vec2 layer = uv * scale + float(layerIndex) + sineAccumulator - time;
          sineAccumulator += sin(layer) + 2.4 * pointerInfluence;
          result += (0.5 + 0.5 * cos(layer)) / scale;
          scale *= 1.2;
        }

        return result.x + result.y;
      }
    `,
    main: `
      vec2 neuralUv = vUV - 0.5;
      neuralUv.x *= uNeuralAspect;
      neuralUv *= 0.5;
      neuralUv += 0.5;
      neuralUv.x += uNeuralScroll;

      vec2 actorDelta = vUV - uNeuralActor;
      actorDelta.x *= uNeuralAspect;
      float actorDistance = length(actorDelta);
      float actorPush = (1.0 - smoothstep(0.035, 0.5, actorDistance)) * uNeuralActorActive;
      neuralUv += actorDelta / max(actorDistance, 0.001) * actorPush * 0.150;

      float signal = neuralShape(neuralUv, uNeuralTime * 0.3, 0.0);
      signal = 1.2 * signal * signal * signal;
      signal += pow(signal, 10.0);
      signal = max(0.0, signal - 0.5);
      signal = pow(clamp(signal * 1.2, 0.0, 1.2), 1.9);

      float actorClearance = smoothstep(0.150, 0.4, actorDistance);
      signal *= mix(1.0, actorClearance, uNeuralActorActive);

      signal *= 1.0 - length(vUV - 0.5) * 0.72;

      vec3 neuralColor = vec3(0.55, 0.08, 1.0);
      vec3 baseColor = vec3(0.006, 0.008, 0.012);
      vec3 color = baseColor + neuralColor * signal * 1.8;
      color += vec3(0.12, 0.025, 0.18) * signal * signal;

      outColor = vec4(color, 1.0);
    `
  }
};
