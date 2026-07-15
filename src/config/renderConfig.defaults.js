export const RENDER_CONFIG_VERSION = 2;

export const DEFAULT_RENDER_CONFIG = Object.freeze({
  schemaVersion: RENDER_CONFIG_VERSION,
  actor: Object.freeze({
    geometry: Object.freeze({
      mode: 'none',
      axisX: 0.5,
      axisY: 0.5,
      sourceX: 'left',
      sourceY: 'top',
      rotation: 0,
      autoRotate: false,
      rotationDirection: 'clockwise',
      rotationSpeed: 12
    }),
    warp: Object.freeze({
      patternBottomScale: 1,
      patternTopScale: 1,
      intensity: 20,
      speed: 1,
      mode: 'classic',
      organicRange: 1,
      layerDivergence: 0.3,
      cursorInfluence: 0.45,
      cursorRadius: 0.22
    }),
    motion: Object.freeze({
      floatSpeed: 1,
      floatAmpX: 30,
      floatAmpY: 50,
      floatRotation: 2,
      flyMinScale: 0.7,
      flyMaxScale: 0.2,
      flyHoverPause: 1,
      flyTiltBias: 3
    }),
    eyes: Object.freeze({
      eyelidTravel: 20,
      blinkInterval: 5,
      blinkSpeed: 1,
      autoBlink: true,
      eyelidManualProgress: 1,
      pupilWander: 1,
      pupilSaccade: 1,
      pupilMouseInfluence: 1
    }),
    aura: Object.freeze({
      opacity: 0.5,
      scale: 1.05,
      blur: 20,
      pulseSpeed: 1,
      color: Object.freeze([235, 200, 150]),
      cavernLightIntensity: 0.8
    }),
    searchlight: Object.freeze({
      enabled: false,
      width: 0.2,
      length: 1,
      radius: 150,
      color: Object.freeze([255, 255, 255])
    })
  }),
  phenomena: Object.freeze({
    veins: Object.freeze({
      enabled: true,
      intensity: 0.35,
      reactionBoost: 0.75,
      speed: 1,
      scale: 18,
      width: 1,
      core: 1.25,
      color: Object.freeze([255, 20, 77]),
      source: Object.freeze([0.5, 0.58])
    }),
    weather: Object.freeze({
      enabled: true,
      intensity: 0.28,
      scale: 2.2,
      speed: 0.55,
      color: Object.freeze([42, 5, 72])
    }),
    shedSkin: Object.freeze({
      enabled: true,
      count: 6,
      spacing: 4,
      lifetime: 0.72,
      opacity: 0.58,
      motionThreshold: 0.035,
      fullSpeed: 1.3,
      fade: 1.45,
      backslide: 8,
      drift: 2,
      expansion: 0.018,
      dissolve: 0.36,
      colorMix: 0.58,
      color: Object.freeze([112, 24, 164])
    })
  })
});
