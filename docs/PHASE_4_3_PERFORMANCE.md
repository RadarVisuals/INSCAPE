# Phase 4.3 environment performance comparison

## Repeatable method

- Development build (`npm run dev`) in Edge/WebGL with the browser's default GPU backend.
- Exact 1920 × 1080 CSS-pixel viewport, device pixel ratio 1.
- Same `abyssal_eye` Keeper, default render configuration, effects, and render resolution.
- Switch only `environmentType`, allow 1.5 seconds to settle, reset `PixiEngine.performanceStats`, then record the rolling 120-sample ticker window for 2.5 seconds.
- Instrumentation remains behind `import.meta.env.DEV`; no production HUD was added.

## Result

| Environment | Average frame time | Equivalent uncapped FPS | Stage source textures requested | Stage display children |
| --- | ---: | ---: | ---: | ---: |
| Illustrated Stage | 7.010 ms | 142.65 | 5 | 9 |
| Neural Field | 7.067 ms | 141.51 | 0 | 1 |

The 0.057 ms difference is within run-to-run noise in this headless comparison. Neural Field therefore showed no material 1080p frame-time regression on the tested GPU backend, but it was not cheaper than the illustrated stage in this run.

The illustrated source payload was about 3.46 MiB compressed for the selected backdrop, two patterns, and two mountains. Their decoded RGBA footprint is approximately 116.5 MiB before render textures and driver overhead. A clean shader-environment rig requests none of those five stage textures. A live switch intentionally retains the shared background-pattern resources so returning to Illustrated Stage is correct; the resource saving applies most clearly to a clean shader load.

Neural Field retains the experiment's 12-iteration fragment loop. No loop-count quality reduction was made. A forced SwiftShader/software-rendering run stalled badly at 1080p, confirming that texture count alone is not a useful cost proxy; software rendering is not included in the GPU result above.
