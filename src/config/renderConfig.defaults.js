export const RENDER_CONFIG_VERSION = 4;

export const DEFAULT_RENDER_CONFIG = Object.freeze({
  schemaVersion: RENDER_CONFIG_VERSION,
  actor: Object.freeze({
    id: 'abyssal_eye',
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
  scene: Object.freeze({
    background: Object.freeze({
      backdropId: 'moonpurple',
      patternStyle: 'digitalblob',
      mountainFrontId: 2,
      mountainBackId: 3,
      scrollSpeed: 30,
      parallaxSpeed: 1.8,
      patternWarp: Object.freeze({
        bottomScale: 1,
        topScale: 1,
        intensity: 20,
        speed: 1
      })
    }),
    atmosphere: Object.freeze({
      particles: Object.freeze({
        count: 80,
        speed: 1,
        wind: 0,
        sway: 1,
        size: 1,
        opacity: 1
      }),
      fog: Object.freeze({
        opacity: 0.4,
        speed: 1,
        color: Object.freeze([140, 120, 180]),
        swaySpeed: 0.5,
        swayAmplitude: 20
      })
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
  }),
  effects: Object.freeze({
    chromaticAberration: Object.freeze({
      amount: 0.0,
      speed: 0.0,
      glitchBurstChance: 0.0
    }),
    flicker: Object.freeze({
      intensity: 0.0,
      speed: 1.0
    }),
    glitch: Object.freeze({
      screenShakeIntensity: 0
    }),
    spectralTrail: Object.freeze({
      count: 3,
      spacing: 5,
      manualAlpha: 0.0,
      glitchInfluence: 0.6
    }),
    screen: Object.freeze({
      scanlineOpacity: 0.15,
      vignetteOpacity: 0.5
    }),
    shockwave: Object.freeze({
      strength: 1.0,
      thickness: 160.0,
      duration: 1.8,
      pulseCount: 2
    })
  })
});
