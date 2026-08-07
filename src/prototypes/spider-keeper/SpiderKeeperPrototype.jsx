import { useEffect, useRef, useState } from 'react';
import {
  SPIDER_MOTION,
  SPIDER_CONTROL_RANGES,
  clamp,
  clampPoint,
  desiredFoot,
  distanceBetween,
  easeInOutCubic,
  lerp,
  makeLegs,
} from './spiderMotion.js';
import {
  CRAWLER_CONTROL_RANGES,
  CRAWLER_MOTION,
  advanceCrawler,
  drawCrawler,
  makeCrawler,
} from './centipedeMotion.js';
import {
  JELLY_DEFAULTS,
  JELLY_RANGES,
  MANTA_DEFAULTS,
  MANTA_RANGES,
  drawJelly,
  drawJellyShadow,
  drawMantaGrid,
  drawMantaUnder,
  makeJelly,
  makeManta,
  updateJelly,
  updateManta,
} from './aerialAquaticOrganisms.js';
import {
  SERPENT_DEFAULTS,
  SERPENT_RANGES,
  drawMembraneGrid,
  drawSerpentOver,
  drawSerpentUnder,
  makeSerpent,
  updateSerpent,
} from './membraneOrganisms.js';
import {
  KEEPER_DOCK_MOTION,
  applyFoldTransform,
  dockPointFromBounds,
  drawFoldSeams,
  easeInOutQuart,
  releasePointFromDock,
} from './keeperDockMotion.js';
import {
  ambientHuntLabel,
  drawAmbientHunt,
  drawAmbientNoticeMark,
  interruptAmbientHunt,
  makeAmbientHunt,
  updateAmbientHunt,
} from './ambientHuntSystem.js';
import {
  drawWalkerWebs,
  makeWalkerWebSystem,
  updateWalkerWebSystem,
} from './walkerWebSystem.js';
import './spiderKeeperPrototype.css';

const COLORS = Object.freeze({
  background: '#050606',
  grid: 'rgba(239, 237, 228, 0.23)',
  gridNear: 'rgba(245, 243, 235, 0.7)',
  leg: 'rgba(242, 240, 232, 0.68)',
  legMoving: 'rgba(255, 253, 246, 0.9)',
  joint: '#f3f1e9',
  core: '#faf8ef',
  target: 'rgba(239, 237, 228, 0.34)',
});

const CREATURE_NAMES = Object.freeze({
  walker: 'GRID WALKER',
  crawler: 'PHASE CRAWLER',
  manta: 'SUBGRID MANTA',
  jelly: 'LATTICE JELLY',
  serpent: 'PHASE SERPENT',
});

function drawGrid(context, width, height, center) {
  const { gridSize } = SPIDER_MOTION;
  const influence = gridSize * 3.4;

  for (let y = 0; y <= height + gridSize; y += gridSize) {
    for (let x = 0; x <= width + gridSize; x += gridSize) {
      const distance = Math.hypot(x - center.x, y - center.y);
      const proximity = clamp(1 - (distance / influence), 0, 1);
      context.beginPath();
      context.fillStyle = proximity > 0.15 ? COLORS.gridNear : COLORS.grid;
      context.arc(x, y, 1.2 + (proximity * 1.25), 0, Math.PI * 2);
      context.fill();
    }
  }
}

function currentFoot(leg, now, tuning) {
  if (!leg.step) return leg.foot;
  const rawProgress = clamp((now - leg.step.startedAt) / leg.step.duration, 0, 1);
  const progress = easeInOutCubic(rawProgress);
  const x = lerp(leg.step.from.x, leg.step.to.x, progress);
  const y = lerp(leg.step.from.y, leg.step.to.y, progress);
  const dx = leg.step.to.x - leg.step.from.x;
  const dy = leg.step.to.y - leg.step.from.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const lift = Math.sin(rawProgress * Math.PI) * tuning.stepLift;
  return {
    x: x + ((-dy / length) * lift * leg.bend),
    y: y + ((dx / length) * lift * leg.bend),
  };
}

function updateFeet(legs, center, now, reducedMotion, cadence, tuning) {
  for (const leg of legs) {
    if (leg.step && now >= leg.step.startedAt + leg.step.duration) {
      leg.foot = leg.step.to;
      leg.step = null;
    }
  }

  const candidates = legs
    .filter((leg) => !leg.step)
    .map((leg) => {
      const target = desiredFoot(center, leg, tuning.legRadius);
      const error = distanceBetween(leg.foot, target);
      const reach = distanceBetween(center, leg.foot);
      const beyondReach = reach > tuning.legRadius + tuning.maxStretch;
      return {
        leg,
        target,
        shouldStep: error > SPIDER_MOTION.replantDistance || beyondReach,
        urgency: Math.max(error, beyondReach ? reach : 0),
      };
    })
    .filter(({ shouldStep }) => shouldStep)
    .sort((first, second) => second.urgency - first.urgency);

  if (reducedMotion) {
    for (const { leg, target } of candidates) leg.foot = target;
    return;
  }

  const activeSteps = legs.reduce((count, leg) => count + (leg.step ? 1 : 0), 0);
  if (
    candidates.length === 0
    || activeSteps >= SPIDER_MOTION.maxConcurrentSteps
    || now < cadence.nextStepAt
  ) return;

  const { leg, target } = candidates[0];
  leg.step = {
    from: { ...leg.foot },
    to: target,
    startedAt: now,
    duration: tuning.stepDuration,
  };
  cadence.nextStepAt = now + SPIDER_MOTION.stepStagger;
}

function constrainedTravelAmount(center, target, legs, requestedAmount, maxReach) {
  const plantedLegs = legs.filter((leg) => !leg.step);
  if (plantedLegs.length === 0) return requestedAmount;

  const isReachable = (amount) => {
    const candidate = {
      x: lerp(center.x, target.x, amount),
      y: lerp(center.y, target.y, amount),
    };
    return plantedLegs.every((leg) => distanceBetween(candidate, leg.foot) <= maxReach);
  };

  if (isReachable(requestedAmount)) return requestedAmount;

  let lower = 0;
  let upper = requestedAmount;
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const middle = (lower + upper) * 0.5;
    if (isReachable(middle)) lower = middle;
    else upper = middle;
  }
  return lower;
}

function drawTarget(context, target, moving) {
  if (!moving) return;
  context.strokeStyle = COLORS.target;
  context.lineWidth = 1;
  context.beginPath();
  context.arc(target.x, target.y, 7, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(target.x - 11, target.y);
  context.lineTo(target.x + 11, target.y);
  context.moveTo(target.x, target.y - 11);
  context.lineTo(target.x, target.y + 11);
  context.stroke();
}

function drawSpider(context, legs, center, now, tuning, heading, activity) {
  for (const leg of legs) {
    const foot = currentFoot(leg, now, tuning);
    const dx = foot.x - center.x;
    const dy = foot.y - center.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const normalX = -dy / length;
    const normalY = dx / length;
    const bend = tuning.jointBend * leg.bend;
    const tension = clamp((length - tuning.legRadius) / Math.max(1, tuning.maxStretch), 0, 1);
    const joint = {
      x: lerp(center.x, foot.x, 0.56) + (normalX * bend),
      y: lerp(center.y, foot.y, 0.56) + (normalY * bend),
    };

    context.strokeStyle = leg.step
      ? COLORS.legMoving
      : `rgba(242, 240, 232, ${0.56 + tension * 0.3})`;
    context.lineWidth = leg.step ? 1.35 : 0.95 + (tension * 0.25);
    context.beginPath();
    context.moveTo(center.x, center.y);
    context.lineTo(joint.x, joint.y);
    context.lineTo(foot.x, foot.y);
    context.stroke();

    context.fillStyle = COLORS.joint;
    context.beginPath();
    context.arc(joint.x, joint.y, leg.step ? 3.1 : 2.65, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(foot.x, foot.y, leg.step ? 2.75 : 2.15, 0, Math.PI * 2);
    context.fill();
    if (!leg.step) {
      context.strokeStyle = `rgba(245, 243, 235, ${0.12 + tension * 0.25})`;
      context.lineWidth = 0.75;
      context.beginPath();
      context.arc(foot.x, foot.y, 4 + (tension * 1.5), 0, Math.PI * 2);
      context.stroke();
    }
  }

  const motionCompression = clamp(activity / 240, 0, 1);
  const breath = 1 + (Math.sin(now * 1.7) * 0.025 * (1 - motionCompression * 0.6));
  context.save();
  context.translate(center.x, center.y);
  context.rotate(heading);
  context.scale(breath, breath);
  context.fillStyle = 'rgba(250, 248, 239, 0.96)';
  context.strokeStyle = 'rgba(5, 6, 6, 0.74)';
  context.lineWidth = 1;
  context.beginPath();
  context.ellipse(0, 3, 10, 8, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.beginPath();
  context.ellipse(0, -6, 7, 6, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.fillStyle = '#050606';
  for (const [x, y] of [[-2.8, -7], [2.8, -7], [-1.5, -4.2], [1.5, -4.2]]) {
    context.beginPath();
    context.arc(x, y, 0.9, 0, Math.PI * 2);
    context.fill();
  }
  context.strokeStyle = 'rgba(250, 248, 239, 0.44)';
  context.beginPath();
  context.arc(0, 1, 14, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = 'rgba(5, 6, 6, 0.42)';
  context.beginPath();
  context.moveTo(-5, 2);
  context.quadraticCurveTo(0, 5 + motionCompression * 2, 5, 2);
  context.stroke();
  context.restore();
}

function RangeControl({ name, label, value, suffix = '', onChange }) {
  const range = SPIDER_CONTROL_RANGES[name];
  return <label className="spider-keeper-prototype__range">
    <span>{label}</span>
    <input
      type="range"
      min={range.min}
      max={range.max}
      step={range.step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
    <output>{value}{suffix}</output>
  </label>;
}

function CrawlerRangeControl({ name, label, value, suffix = '', onChange }) {
  const range = CRAWLER_CONTROL_RANGES[name];
  return <label className="spider-keeper-prototype__range">
    <span>{label}</span>
    <input
      type="range"
      min={range.min}
      max={range.max}
      step={range.step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
    <output>{value}{suffix}</output>
  </label>;
}

function OrganismRangeControl({ ranges, name, label, value, suffix = '', onChange }) {
  const range = ranges[name];
  return <label className="spider-keeper-prototype__range">
    <span>{label}</span>
    <input
      type="range"
      min={range.min}
      max={range.max}
      step={range.step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
    <output>{value}{suffix}</output>
  </label>;
}

export default function SpiderKeeperPrototype() {
  const canvasRef = useRef(null);
  const dockRef = useRef(null);
  const dockCommandRef = useRef({ id: 0, type: null });
  const dockPhaseRef = useRef('free');
  const interactionModeRef = useRef('click');
  const creatureModeRef = useRef('walker');
  const ambientLifeRef = useRef(true);
  const userCommandRef = useRef(0);
  const [interactionMode, setInteractionMode] = useState('click');
  const [creatureMode, setCreatureMode] = useState('walker');
  const [ambientLife, setAmbientLife] = useState(true);
  const [ambientPhase, setAmbientPhase] = useState('dormant');
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [dockPhase, setDockPhase] = useState('free');
  const [tuning, setTuning] = useState(() => ({
    legCount: SPIDER_MOTION.legCount,
    legRadius: SPIDER_MOTION.legRadius,
    maxStretch: SPIDER_MOTION.maxStretch,
    bodySpeed: SPIDER_MOTION.bodySpeed,
    stepDuration: SPIDER_MOTION.stepDuration,
    stepLift: SPIDER_MOTION.stepLift,
    jointBend: SPIDER_MOTION.jointBend,
  }));
  const tuningRef = useRef(tuning);
  tuningRef.current = tuning;
  const [crawlerTuning, setCrawlerTuning] = useState(() => ({
    segmentCount: CRAWLER_MOTION.segmentCount,
    segmentSpacing: CRAWLER_MOTION.segmentSpacing,
    legLength: CRAWLER_MOTION.legLength,
    headSpeed: CRAWLER_MOTION.headSpeed,
    waveSpeed: CRAWLER_MOTION.waveSpeed,
    phaseSpread: CRAWLER_MOTION.phaseSpread,
    legSweep: CRAWLER_MOTION.legSweep,
  }));
  const crawlerTuningRef = useRef(crawlerTuning);
  crawlerTuningRef.current = crawlerTuning;
  const [mantaTuning, setMantaTuning] = useState(() => ({ ...MANTA_DEFAULTS }));
  const mantaTuningRef = useRef(mantaTuning);
  mantaTuningRef.current = mantaTuning;
  const [jellyTuning, setJellyTuning] = useState(() => ({ ...JELLY_DEFAULTS }));
  const jellyTuningRef = useRef(jellyTuning);
  jellyTuningRef.current = jellyTuning;
  const [serpentTuning, setSerpentTuning] = useState(() => ({ ...SERPENT_DEFAULTS }));
  const serpentTuningRef = useRef(serpentTuning);
  serpentTuningRef.current = serpentTuning;

  const noteUserCommand = () => {
    userCommandRef.current += 1;
  };

  const selectMode = (mode) => {
    noteUserCommand();
    interactionModeRef.current = mode;
    setInteractionMode(mode);
  };

  const selectCreature = (mode) => {
    noteUserCommand();
    creatureModeRef.current = mode;
    setCreatureMode(mode);
  };

  const toggleAmbientLife = () => {
    noteUserCommand();
    const enabled = !ambientLifeRef.current;
    ambientLifeRef.current = enabled;
    setAmbientLife(enabled);
  };

  const setParameter = (name, value) => {
    noteUserCommand();
    setTuning((current) => ({ ...current, [name]: value }));
  };

  const setCrawlerParameter = (name, value) => {
    noteUserCommand();
    setCrawlerTuning((current) => ({ ...current, [name]: value }));
  };

  const setOrganismParameter = (setter, name, value) => {
    noteUserCommand();
    setter((current) => ({ ...current, [name]: value }));
  };

  const toggleDock = () => {
    const phase = dockPhaseRef.current;
    if (phase !== 'free' && phase !== 'docked') return;
    noteUserCommand();
    dockCommandRef.current = {
      id: dockCommandRef.current.id + 1,
      type: phase === 'docked' ? 'release' : 'dock',
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return undefined;

    let animationFrame = 0;
    let lastFrame = performance.now();
    let renderEnergy = 1;
    let width = 0;
    let height = 0;
    let reducedMotion = false;
    let legs = [];
    let crawlerNodes = [];
    let crawlerGaitPhase = 0;
    let crawlerMotion = 0;
    let walkerHeading = 0;
    let walkerActivity = 0;
    const walkerWebs = makeWalkerWebSystem();
    const walkerIdleRoam = {
      anchor: null,
      target: null,
      nextMoveAt: (performance.now() / 1000) + 4,
    };
    let manta = null;
    let jelly = null;
    let serpent = null;
    const ambientHunt = makeAmbientHunt(performance.now() / 1000);
    let publishedAmbientPhase = ambientHunt.phase;
    let lastUserActivity = performance.now() / 1000;
    let lastUserCommand = userCommandRef.current;
    let dockPhaseValue = dockPhaseRef.current;
    let lastDockCommand = 0;
    let dockTransitionStarted = 0;
    let dockPoint = null;
    let dockReleasePoint = null;
    let dockFoldAmount = dockPhaseValue === 'docked' ? 1 : 0;
    let renderedCreature = creatureModeRef.current;
    const center = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    const userTarget = { x: 0, y: 0 };
    const pointer = { x: 0, y: 0 };
    const cadence = { nextStepAt: 0 };
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const applyReducedMotion = () => {
      reducedMotion = motionQuery.matches;
    };

    const publishDockPhase = (nextPhase) => {
      dockPhaseValue = nextPhase;
      dockPhaseRef.current = nextPhase;
      setDockPhase(nextPhase);
    };

    const resize = () => {
      renderEnergy = 1;
      const bounds = canvas.getBoundingClientRect();
      const nextDockPoint = dockPointFromBounds(dockRef.current?.getBoundingClientRect());
      if (nextDockPoint) dockPoint = nextDockPoint;
      const nextWidth = Math.max(1, bounds.width);
      const nextHeight = Math.max(1, bounds.height);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(nextWidth * pixelRatio);
      canvas.height = Math.round(nextHeight * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      if (width === 0 || height === 0) {
        center.x = nextWidth * 0.5;
        center.y = nextHeight * 0.52;
        target.x = center.x;
        target.y = center.y;
        userTarget.x = center.x;
        userTarget.y = center.y;
        pointer.x = center.x;
        pointer.y = center.y;
        legs = makeLegs(center, tuningRef.current.legCount, tuningRef.current.legRadius);
        crawlerNodes = makeCrawler(center, crawlerTuningRef.current.segmentCount, crawlerTuningRef.current.segmentSpacing);
        manta = makeManta(center);
        jelly = makeJelly(center, jellyTuningRef.current);
        serpent = makeSerpent(center, serpentTuningRef.current);
      } else {
        const scaleX = nextWidth / width;
        const scaleY = nextHeight / height;
        center.x *= scaleX;
        center.y *= scaleY;
        target.x *= scaleX;
        target.y *= scaleY;
        userTarget.x *= scaleX;
        userTarget.y *= scaleY;
        pointer.x *= scaleX;
        pointer.y *= scaleY;
        if (ambientHunt.prey) {
          ambientHunt.prey.x *= scaleX;
          ambientHunt.prey.y *= scaleY;
        }
        if (walkerIdleRoam.anchor) {
          walkerIdleRoam.anchor.x *= scaleX;
          walkerIdleRoam.anchor.y *= scaleY;
        }
        if (walkerIdleRoam.target) {
          walkerIdleRoam.target.x *= scaleX;
          walkerIdleRoam.target.y *= scaleY;
        }
        for (const leg of legs) {
          leg.foot = desiredFoot(center, leg, tuningRef.current.legRadius);
          leg.step = null;
        }
        for (const node of crawlerNodes) {
          node.x *= scaleX;
          node.y *= scaleY;
        }
        manta.position.x *= scaleX;
        manta.position.y *= scaleY;
        for (const ripple of manta.ripples) {
          ripple.x *= scaleX;
          ripple.y *= scaleY;
        }
        jelly.position.x *= scaleX;
        jelly.position.y *= scaleY;
        for (const anchor of jelly.anchors) {
          anchor.position.x *= scaleX;
          anchor.position.y *= scaleY;
        }
        for (const node of serpent.nodes) {
          node.x *= scaleX;
          node.y *= scaleY;
        }
      }

      width = nextWidth;
      height = nextHeight;
    };

    const localPoint = (event) => {
      const bounds = canvas.getBoundingClientRect();
      return clampPoint({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      }, width, height);
    };

    const handlePointerMove = (event) => {
      renderEnergy = 1;
      const next = localPoint(event);
      pointer.x = next.x;
      pointer.y = next.y;
      if (interactionModeRef.current === 'follow' && dockPhaseValue === 'free') {
        lastUserActivity = performance.now() / 1000;
        interruptAmbientHunt(ambientHunt, creatureHead(renderedCreature), lastUserActivity);
        userTarget.x = pointer.x;
        userTarget.y = pointer.y;
        walkerIdleRoam.anchor = { ...pointer };
        walkerIdleRoam.target = null;
        walkerIdleRoam.nextMoveAt = lastUserActivity + 4;
        target.x = pointer.x;
        target.y = pointer.y;
      }
    };

    const handlePointerDown = (event) => {
      if (interactionModeRef.current !== 'click' || dockPhaseValue !== 'free') return;
      renderEnergy = 1;
      const next = localPoint(event);
      lastUserActivity = performance.now() / 1000;
      interruptAmbientHunt(ambientHunt, creatureHead(renderedCreature), lastUserActivity);
      userTarget.x = next.x;
      userTarget.y = next.y;
      walkerIdleRoam.anchor = { ...next };
      walkerIdleRoam.target = null;
      walkerIdleRoam.nextMoveAt = lastUserActivity + 4;
      target.x = next.x;
      target.y = next.y;
    };

    const creatureHead = (mode) => {
      if (mode === 'crawler') return crawlerNodes[0] || center;
      if (mode === 'manta') return manta?.position || center;
      if (mode === 'jelly') return jelly?.position || center;
      if (mode === 'serpent') return serpent?.nodes[0] || center;
      return center;
    };

    const render = (now) => {
      const elapsed = now - lastFrame;
      if (renderEnergy < 0.025 && elapsed < (1000 / 24)) {
        animationFrame = window.requestAnimationFrame(render);
        return;
      }
      const delta = Math.min(elapsed / 1000, SPIDER_MOTION.maxDelta);
      lastFrame = now;
      const nowSeconds = now / 1000;

      if (lastUserCommand !== userCommandRef.current) {
        lastUserCommand = userCommandRef.current;
        lastUserActivity = nowSeconds;
        interruptAmbientHunt(ambientHunt, creatureHead(renderedCreature), nowSeconds);
      }

      const dockCommand = dockCommandRef.current;
      if (dockCommand.id !== lastDockCommand && dockPoint) {
        lastDockCommand = dockCommand.id;
        if (dockCommand.type === 'dock' && dockPhaseValue === 'free') {
          dockFoldAmount = 0;
          publishDockPhase('approaching');
        } else if (dockCommand.type === 'release' && dockPhaseValue === 'docked') {
          dockTransitionStarted = nowSeconds;
          dockReleasePoint = releasePointFromDock(dockPoint, width, height);
          publishDockPhase('unfolding');
        }
      }

      if (dockPhaseValue === 'folding') {
        const progress = reducedMotion
          ? 1
          : clamp((nowSeconds - dockTransitionStarted) / KEEPER_DOCK_MOTION.foldDuration, 0, 1);
        dockFoldAmount = easeInOutQuart(progress);
        if (progress >= 1) publishDockPhase('docked');
      } else if (dockPhaseValue === 'docked') {
        dockFoldAmount = 1;
      } else if (dockPhaseValue === 'unfolding') {
        const progress = reducedMotion
          ? 1
          : clamp((nowSeconds - dockTransitionStarted) / KEEPER_DOCK_MOTION.unfoldDuration, 0, 1);
        dockFoldAmount = 1 - easeInOutQuart(progress);
        if (progress >= 1) {
          dockFoldAmount = 0;
          publishDockPhase('free');
        }
      } else {
        dockFoldAmount = 0;
      }

      if ((dockPhaseValue === 'approaching' || dockPhaseValue === 'folding' || dockPhaseValue === 'docked') && dockPoint) {
        target.x = dockPoint.x;
        target.y = dockPoint.y;
      } else if (dockPhaseValue === 'unfolding' && dockReleasePoint) {
        target.x = dockReleasePoint.x;
        target.y = dockReleasePoint.y;
      }

      if (interactionModeRef.current === 'follow' && dockPhaseValue === 'free') {
        target.x = pointer.x;
        target.y = pointer.y;
      }

      if (renderedCreature !== creatureModeRef.current) {
        const previousHead = creatureHead(renderedCreature);
        const origin = { x: previousHead.x, y: previousHead.y };
        if (creatureModeRef.current === 'walker') {
          center.x = origin.x;
          center.y = origin.y;
          legs = makeLegs(center, tuningRef.current.legCount, tuningRef.current.legRadius);
        } else if (creatureModeRef.current === 'crawler') {
          crawlerNodes = makeCrawler(origin, crawlerTuningRef.current.segmentCount, crawlerTuningRef.current.segmentSpacing);
        } else if (creatureModeRef.current === 'manta') {
          manta = makeManta(origin);
        } else if (creatureModeRef.current === 'jelly') {
          jelly = makeJelly(origin, jellyTuningRef.current);
        } else if (creatureModeRef.current === 'serpent') {
          serpent = makeSerpent(origin, serpentTuningRef.current);
        }
        renderedCreature = creatureModeRef.current;
      }

      if (dockPhaseValue === 'free') {
        const restingTarget = interactionModeRef.current === 'follow' ? pointer : userTarget;
        target.x = restingTarget.x;
        target.y = restingTarget.y;
      }

      const activeHeadBeforeHunt = creatureHead(renderedCreature);
      const ambientResult = updateAmbientHunt(ambientHunt, {
        now: nowSeconds,
        delta,
        width,
        height,
        keeper: activeHeadBeforeHunt,
        creature: renderedCreature,
        enabled: ambientLifeRef.current,
        dockPhase: dockPhaseValue,
        userIdle: nowSeconds - lastUserActivity,
      });
      if (ambientResult.target && dockPhaseValue === 'free') {
        target.x = ambientResult.target.x;
        target.y = ambientResult.target.y;
      }
      if (ambientResult.retainPosition && dockPhaseValue === 'free') {
        const restingHead = creatureHead(renderedCreature);
        userTarget.x = restingHead.x;
        userTarget.y = restingHead.y;
        target.x = restingHead.x;
        target.y = restingHead.y;
        walkerIdleRoam.anchor = ambientResult.retainArea || { ...restingHead };
        walkerIdleRoam.target = null;
        walkerIdleRoam.nextMoveAt = nowSeconds + 4.5;
      }
      if (ambientHunt.phase !== publishedAmbientPhase) {
        publishedAmbientPhase = ambientHunt.phase;
        setAmbientPhase(publishedAmbientPhase);
      }

      let walkerIdleRoaming = false;
      const headBeforeIdleRoam = creatureHead(renderedCreature);
      const canIdleRoam = renderedCreature === 'walker'
        && dockPhaseValue === 'free'
        && !ambientResult.target
        && nowSeconds - lastUserActivity > 3
        && (walkerIdleRoam.target || distanceBetween(headBeforeIdleRoam, userTarget) < 3);
      if (canIdleRoam) {
        if (!walkerIdleRoam.anchor) walkerIdleRoam.anchor = { ...headBeforeIdleRoam };
        if (walkerIdleRoam.target && distanceBetween(headBeforeIdleRoam, walkerIdleRoam.target) < 2.5) {
          userTarget.x = headBeforeIdleRoam.x;
          userTarget.y = headBeforeIdleRoam.y;
          walkerIdleRoam.target = null;
          walkerIdleRoam.nextMoveAt = nowSeconds + 4.5 + (Math.random() * 3.5);
        }
        if (!walkerIdleRoam.target && nowSeconds >= walkerIdleRoam.nextMoveAt) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 24 + (Math.random() * 46);
          walkerIdleRoam.target = clampPoint({
            x: walkerIdleRoam.anchor.x + (Math.cos(angle) * radius),
            y: walkerIdleRoam.anchor.y + (Math.sin(angle) * radius),
          }, width, height);
        }
        if (walkerIdleRoam.target) {
          target.x = walkerIdleRoam.target.x;
          target.y = walkerIdleRoam.target.y;
          walkerIdleRoaming = true;
        }
      } else if (nowSeconds - lastUserActivity < 1 || ambientResult.target || dockPhaseValue !== 'free') {
        walkerIdleRoam.target = null;
      }

      const activeHead = creatureHead(renderedCreature);
      const distanceToTarget = distanceBetween(activeHead, target);
      let nextRenderEnergy = Math.max(distanceToTarget > 0.8 ? 1 : 0, ambientResult.energy);
      if (renderedCreature === 'walker' && distanceToTarget > SPIDER_MOTION.settleDistance) {
        const previousX = center.x;
        const previousY = center.y;
        const travel = tuningRef.current.bodySpeed * (walkerIdleRoaming ? 0.055 : 1) * delta;
        const requestedAmount = reducedMotion ? 1 : Math.min(1, travel / distanceToTarget);
        const amount = reducedMotion
          ? requestedAmount
          : constrainedTravelAmount(
            center,
            target,
            legs,
            requestedAmount,
            tuningRef.current.legRadius
              + tuningRef.current.maxStretch
              + (SPIDER_MOTION.gridSize * 0.48),
          );
        center.x = lerp(center.x, target.x, amount);
        center.y = lerp(center.y, target.y, amount);
        const movedX = center.x - previousX;
        const movedY = center.y - previousY;
        const moved = Math.hypot(movedX, movedY);
        walkerActivity = moved / Math.max(0.0001, delta);
        if (moved > 0.01) {
          const desiredHeading = Math.atan2(movedY, movedX) + (Math.PI / 2);
          const angleDelta = Math.atan2(
            Math.sin(desiredHeading - walkerHeading),
            Math.cos(desiredHeading - walkerHeading),
          );
          walkerHeading += angleDelta * (1 - Math.exp(-9 * delta));
        }
      } else if (renderedCreature === 'walker') {
        center.x = target.x;
        center.y = target.y;
        walkerActivity = lerp(walkerActivity, 0, 1 - Math.exp(-8 * delta));
      }

      if (renderedCreature === 'walker' && legs.length !== tuningRef.current.legCount) {
        legs = makeLegs(center, tuningRef.current.legCount, tuningRef.current.legRadius);
      }
      if (renderedCreature === 'crawler' && crawlerNodes.length !== crawlerTuningRef.current.segmentCount) {
        crawlerNodes = makeCrawler(activeHead, crawlerTuningRef.current.segmentCount, crawlerTuningRef.current.segmentSpacing);
      }

      if (renderedCreature === 'walker') {
        updateFeet(legs, center, now / 1000, reducedMotion, cadence, tuningRef.current);
        nextRenderEnergy = Math.max(
          nextRenderEnergy,
          walkerActivity / Math.max(1, tuningRef.current.bodySpeed),
          legs.some((leg) => leg.step) ? 1 : 0,
        );
      } else if (renderedCreature === 'crawler') {
        const crawlerActivity = advanceCrawler(
          crawlerNodes,
          target,
          delta,
          crawlerTuningRef.current,
          reducedMotion,
        );
        if (!reducedMotion && crawlerActivity > 0.05) {
          const fullFrameTravel = Math.max(0.01, crawlerTuningRef.current.headSpeed * delta);
          const motionRatio = clamp(crawlerActivity / fullFrameTravel, 0, 1);
          crawlerGaitPhase += delta * crawlerTuningRef.current.waveSpeed * motionRatio;
          crawlerMotion = lerp(crawlerMotion, motionRatio, 1 - Math.exp(-8 * delta));
        } else {
          crawlerMotion = lerp(crawlerMotion, 0, 1 - Math.exp(-7 * delta));
        }
        nextRenderEnergy = Math.max(nextRenderEnergy, crawlerMotion);
      } else if (renderedCreature === 'manta') {
        const activity = updateManta(manta, target, delta, mantaTuningRef.current, reducedMotion);
        nextRenderEnergy = Math.max(
          nextRenderEnergy,
          activity / Math.max(1, mantaTuningRef.current.speed),
          manta.ripples.length > 0 ? 0.5 : 0,
        );
      } else if (renderedCreature === 'jelly') {
        const activity = updateJelly(jelly, target, delta, jellyTuningRef.current, reducedMotion);
        nextRenderEnergy = Math.max(
          nextRenderEnergy,
          activity / Math.max(1, jellyTuningRef.current.speed),
          jelly.anchors.some((anchor) => anchor.target) ? 0.7 : 0,
        );
      } else if (renderedCreature === 'serpent') {
        const activity = updateSerpent(serpent, target, delta, serpentTuningRef.current, reducedMotion);
        nextRenderEnergy = Math.max(nextRenderEnergy, activity / Math.max(1, serpentTuningRef.current.speed));
      }

      nextRenderEnergy = Math.max(nextRenderEnergy, updateWalkerWebSystem(walkerWebs, {
        now: nowSeconds,
        center,
        legs,
        activity: walkerActivity,
        enabled: renderedCreature === 'walker' && dockPhaseValue === 'free',
        reducedMotion,
      }));

      if (
        dockPhaseValue === 'approaching'
        && dockPoint
        && distanceBetween(creatureHead(renderedCreature), dockPoint) <= KEEPER_DOCK_MOTION.approachRadius
      ) {
        dockTransitionStarted = nowSeconds;
        publishDockPhase('folding');
      }
      if (dockPhaseValue === 'approaching' || dockPhaseValue === 'folding' || dockPhaseValue === 'unfolding') {
        nextRenderEnergy = 1;
      } else if (dockPhaseValue === 'docked') {
        nextRenderEnergy = 0;
      }
      renderEnergy = nextRenderEnergy;

      context.clearRect(0, 0, width, height);
      context.fillStyle = COLORS.background;
      context.fillRect(0, 0, width, height);
      const drawKeeperLayer = (drawLayer) => {
        if (dockPhaseValue === 'docked') return;
        context.save();
        applyFoldTransform(context, dockPoint, dockFoldAmount, renderedCreature);
        drawLayer();
        context.restore();
      };

      if (renderedCreature === 'walker') {
        drawGrid(context, width, height, center);
        drawWalkerWebs(context, walkerWebs, nowSeconds);
      } else if (renderedCreature === 'manta') {
        drawKeeperLayer(() => drawMantaUnder(context, manta, mantaTuningRef.current));
        drawMantaGrid(context, width, height, manta, mantaTuningRef.current, 1 - dockFoldAmount);
      } else if (renderedCreature === 'jelly') {
        drawGrid(context, width, height, jelly.position);
        drawKeeperLayer(() => drawJellyShadow(context, jelly, jellyTuningRef.current));
      } else if (renderedCreature === 'serpent') {
        drawKeeperLayer(() => drawSerpentUnder(context, serpent, serpentTuningRef.current));
        drawMembraneGrid(context, width, height, 68, 0.34);
      }

      drawTarget(
        context,
        target,
        dockPhaseValue === 'free'
          && !ambientResult.target
          && !walkerIdleRoaming
          && distanceToTarget > 3
          && interactionModeRef.current === 'click',
      );
      if (renderedCreature === 'walker') {
        drawKeeperLayer(() => drawSpider(
          context,
          legs,
          center,
          now / 1000,
          tuningRef.current,
          walkerHeading,
          walkerActivity,
        ));
      } else if (renderedCreature === 'crawler') {
        drawKeeperLayer(() => drawCrawler(
          context,
          crawlerNodes,
          crawlerGaitPhase,
          crawlerTuningRef.current,
          crawlerMotion,
        ));
      } else if (renderedCreature === 'jelly') {
        drawKeeperLayer(() => drawJelly(context, jelly, now / 1000, jellyTuningRef.current));
      } else if (renderedCreature === 'serpent') {
        drawKeeperLayer(() => drawSerpentOver(context, serpent, serpentTuningRef.current));
      }
      drawAmbientHunt(context, ambientHunt, nowSeconds);
      if (dockPhaseValue === 'free') {
        drawAmbientNoticeMark(context, ambientHunt, creatureHead(renderedCreature), nowSeconds);
      }
      drawFoldSeams(context, dockPoint, dockFoldAmount, renderedCreature);
      animationFrame = window.requestAnimationFrame(render);
    };

    applyReducedMotion();
    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerdown', handlePointerDown);
    motionQuery.addEventListener?.('change', applyReducedMotion);
    animationFrame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      motionQuery.removeEventListener?.('change', applyReducedMotion);
    };
  }, []);

  const creatureStatus = creatureMode === 'walker'
    ? `${tuning.legCount}-POINT LATTICE`
    : creatureMode === 'crawler'
      ? `${crawlerTuning.segmentCount}-SEGMENT CHAIN`
      : creatureMode === 'manta'
        ? 'SUBGRID DEFORMATION'
        : creatureMode === 'jelly'
          ? `${jellyTuning.tendrilCount}-TETHER DRIFT`
          : `${serpentTuning.segmentCount}-SEGMENT PHASE`;

  return <main className="spider-keeper-prototype">
    <canvas
      ref={canvasRef}
      className="spider-keeper-prototype__canvas"
      aria-label="An interactive terrarium of procedural INSCAPE Keeper organisms"
    />

    <header className="spider-keeper-prototype__heading">
      <small>INSCAPE / KEEPER MOTION STUDY</small>
      <h1>{CREATURE_NAMES[creatureMode]}</h1>
      <p>{interactionMode === 'click' ? 'Click anywhere to move.' : 'Move the pointer to lead.'}</p>
    </header>

    <nav className="spider-keeper-prototype__organisms" aria-label="Keeper organism">
      {Object.keys(CREATURE_NAMES).map((mode) => <button
        key={mode}
        type="button"
        aria-pressed={creatureMode === mode}
        onClick={() => selectCreature(mode)}
      >{mode.toUpperCase()}</button>)}
    </nav>

    <nav className="spider-keeper-prototype__modes" aria-label="Keeper movement mode">
      <button
        type="button"
        aria-pressed={interactionMode === 'click'}
        onClick={() => selectMode('click')}
      >CLICK</button>
      <button
        type="button"
        aria-pressed={interactionMode === 'follow'}
        onClick={() => selectMode('follow')}
      >FOLLOW</button>
      <button
        type="button"
        aria-pressed={optionsOpen}
        onClick={() => setOptionsOpen((open) => !open)}
      >TUNE</button>
      <button
        type="button"
        aria-pressed={ambientLife}
        onClick={toggleAmbientLife}
        title="Allow tiny grid life to appear when the Keeper is left alone"
      >LIFE</button>
    </nav>

    <aside className="spider-keeper-prototype__dock-wrap" data-phase={dockPhase}>
      <button
        ref={dockRef}
        className="spider-keeper-prototype__dock"
        type="button"
        data-phase={dockPhase}
        data-organism={creatureMode}
        onClick={toggleDock}
        disabled={dockPhase !== 'free' && dockPhase !== 'docked'}
        aria-label={dockPhase === 'docked' ? `Release ${CREATURE_NAMES[creatureMode]} from dock` : `Dock ${CREATURE_NAMES[creatureMode]}`}
      >
        <span className="spider-keeper-prototype__dock-grid" aria-hidden="true" />
        <span className="spider-keeper-prototype__dock-aperture" aria-hidden="true" />
        <span className="spider-keeper-prototype__dock-resident" aria-hidden="true">
          <i /><i /><i />
        </span>
      </button>
      <footer aria-hidden="true">
        <strong>KEEPER DOCK</strong>
        <span>{dockPhase.toUpperCase()}</span>
      </footer>
    </aside>

    {optionsOpen && creatureMode === 'walker' && <aside className="spider-keeper-prototype__controls" aria-label="Spider Keeper parameters">
      <header><strong>MOTION PARAMETERS</strong><span>LIVE</span></header>
      <RangeControl name="legCount" label="LEGS" value={tuning.legCount} onChange={(value) => setParameter('legCount', value)} />
      <RangeControl name="legRadius" label="LEG LENGTH" value={tuning.legRadius} suffix="px" onChange={(value) => setParameter('legRadius', value)} />
      <RangeControl name="maxStretch" label="MAX STRETCH" value={tuning.maxStretch} suffix="px" onChange={(value) => setParameter('maxStretch', value)} />
      <RangeControl name="bodySpeed" label="TRAVEL" value={tuning.bodySpeed} suffix="px/s" onChange={(value) => setParameter('bodySpeed', value)} />
      <RangeControl name="stepDuration" label="STEP TIME" value={tuning.stepDuration} suffix="s" onChange={(value) => setParameter('stepDuration', value)} />
      <RangeControl name="stepLift" label="STEP LIFT" value={tuning.stepLift} suffix="px" onChange={(value) => setParameter('stepLift', value)} />
      <RangeControl name="jointBend" label="JOINT BEND" value={tuning.jointBend} suffix="px" onChange={(value) => setParameter('jointBend', value)} />
    </aside>}

    {optionsOpen && creatureMode === 'crawler' && <aside className="spider-keeper-prototype__controls" aria-label="Phase Crawler parameters">
      <header><strong>CRAWLER PARAMETERS</strong><span>LIVE</span></header>
      <CrawlerRangeControl name="segmentCount" label="SEGMENTS" value={crawlerTuning.segmentCount} onChange={(value) => setCrawlerParameter('segmentCount', value)} />
      <CrawlerRangeControl name="segmentSpacing" label="SPACING" value={crawlerTuning.segmentSpacing} suffix="px" onChange={(value) => setCrawlerParameter('segmentSpacing', value)} />
      <CrawlerRangeControl name="legLength" label="LEG LENGTH" value={crawlerTuning.legLength} suffix="px" onChange={(value) => setCrawlerParameter('legLength', value)} />
      <CrawlerRangeControl name="headSpeed" label="TRAVEL" value={crawlerTuning.headSpeed} suffix="px/s" onChange={(value) => setCrawlerParameter('headSpeed', value)} />
      <CrawlerRangeControl name="waveSpeed" label="WAVE SPEED" value={crawlerTuning.waveSpeed} onChange={(value) => setCrawlerParameter('waveSpeed', value)} />
      <CrawlerRangeControl name="phaseSpread" label="PHASE" value={crawlerTuning.phaseSpread} onChange={(value) => setCrawlerParameter('phaseSpread', value)} />
      <CrawlerRangeControl name="legSweep" label="LEG SWEEP" value={crawlerTuning.legSweep} suffix="px" onChange={(value) => setCrawlerParameter('legSweep', value)} />
    </aside>}

    {optionsOpen && creatureMode === 'manta' && <aside className="spider-keeper-prototype__controls" aria-label="Subgrid Manta parameters">
      <header><strong>MANTA PARAMETERS</strong><span>BELOW</span></header>
      <OrganismRangeControl ranges={MANTA_RANGES} name="speed" label="TRAVEL" value={mantaTuning.speed} suffix="px/s" onChange={(value) => setOrganismParameter(setMantaTuning, 'speed', value)} />
      <OrganismRangeControl ranges={MANTA_RANGES} name="wingspan" label="WINGSPAN" value={mantaTuning.wingspan} suffix="px" onChange={(value) => setOrganismParameter(setMantaTuning, 'wingspan', value)} />
      <OrganismRangeControl ranges={MANTA_RANGES} name="distortion" label="DISTORTION" value={mantaTuning.distortion} suffix="px" onChange={(value) => setOrganismParameter(setMantaTuning, 'distortion', value)} />
      <OrganismRangeControl ranges={MANTA_RANGES} name="gridSize" label="GRID SIZE" value={mantaTuning.gridSize} suffix="px" onChange={(value) => setOrganismParameter(setMantaTuning, 'gridSize', value)} />
      <OrganismRangeControl ranges={MANTA_RANGES} name="rippleStrength" label="WAKE" value={mantaTuning.rippleStrength} onChange={(value) => setOrganismParameter(setMantaTuning, 'rippleStrength', value)} />
      <OrganismRangeControl ranges={MANTA_RANGES} name="steering" label="STEERING" value={mantaTuning.steering} onChange={(value) => setOrganismParameter(setMantaTuning, 'steering', value)} />
    </aside>}

    {optionsOpen && creatureMode === 'jelly' && <aside className="spider-keeper-prototype__controls" aria-label="Lattice Jelly parameters">
      <header><strong>JELLY PARAMETERS</strong><span>ABOVE</span></header>
      <OrganismRangeControl ranges={JELLY_RANGES} name="tendrilCount" label="TENDRILS" value={jellyTuning.tendrilCount} onChange={(value) => setOrganismParameter(setJellyTuning, 'tendrilCount', value)} />
      <OrganismRangeControl ranges={JELLY_RANGES} name="bellRadius" label="BELL SIZE" value={jellyTuning.bellRadius} suffix="px" onChange={(value) => setOrganismParameter(setJellyTuning, 'bellRadius', value)} />
      <OrganismRangeControl ranges={JELLY_RANGES} name="tetherLength" label="TETHERS" value={jellyTuning.tetherLength} suffix="px" onChange={(value) => setOrganismParameter(setJellyTuning, 'tetherLength', value)} />
      <OrganismRangeControl ranges={JELLY_RANGES} name="speed" label="TRAVEL" value={jellyTuning.speed} suffix="px/s" onChange={(value) => setOrganismParameter(setJellyTuning, 'speed', value)} />
      <OrganismRangeControl ranges={JELLY_RANGES} name="elasticity" label="ELASTICITY" value={jellyTuning.elasticity} suffix="px" onChange={(value) => setOrganismParameter(setJellyTuning, 'elasticity', value)} />
      <OrganismRangeControl ranges={JELLY_RANGES} name="pulseSpeed" label="PULSE" value={jellyTuning.pulseSpeed} onChange={(value) => setOrganismParameter(setJellyTuning, 'pulseSpeed', value)} />
    </aside>}

    {optionsOpen && creatureMode === 'serpent' && <aside className="spider-keeper-prototype__controls" aria-label="Phase Serpent parameters">
      <header><strong>SERPENT PARAMETERS</strong><span>PHASING</span></header>
      <OrganismRangeControl ranges={SERPENT_RANGES} name="segmentCount" label="SEGMENTS" value={serpentTuning.segmentCount} onChange={(value) => setOrganismParameter(setSerpentTuning, 'segmentCount', value)} />
      <OrganismRangeControl ranges={SERPENT_RANGES} name="segmentSpacing" label="SPACING" value={serpentTuning.segmentSpacing} suffix="px" onChange={(value) => setOrganismParameter(setSerpentTuning, 'segmentSpacing', value)} />
      <OrganismRangeControl ranges={SERPENT_RANGES} name="thickness" label="BODY" value={serpentTuning.thickness} suffix="px" onChange={(value) => setOrganismParameter(setSerpentTuning, 'thickness', value)} />
      <OrganismRangeControl ranges={SERPENT_RANGES} name="speed" label="TRAVEL" value={serpentTuning.speed} suffix="px/s" onChange={(value) => setOrganismParameter(setSerpentTuning, 'speed', value)} />
      <OrganismRangeControl ranges={SERPENT_RANGES} name="depthFrequency" label="CROSSINGS" value={serpentTuning.depthFrequency} onChange={(value) => setOrganismParameter(setSerpentTuning, 'depthFrequency', value)} />
      <OrganismRangeControl ranges={SERPENT_RANGES} name="depthAmplitude" label="DEPTH" value={serpentTuning.depthAmplitude} onChange={(value) => setOrganismParameter(setSerpentTuning, 'depthAmplitude', value)} />
    </aside>}

    <footer className="spider-keeper-prototype__status" aria-hidden="true">
      <span>{creatureStatus}</span>
      <span>{ambientLife ? ambientHuntLabel(ambientPhase) : 'LIFE OFF'}</span>
      <span>{interactionMode.toUpperCase()} MODE</span>
    </footer>
  </main>;
}
