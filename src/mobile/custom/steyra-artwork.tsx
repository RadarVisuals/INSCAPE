"use client";

import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import type { HeadPose } from './head-pose';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SERIF_NS = 'http://www.serif.com/';
type Eye = {
  group: SVGGElement; gaze: SVGGElement; reflection: SVGGElement; radius: number;
  pupil: SVGCircleElement; pupilRadius: number;
};

// This adapter is for the reviewed, bundled Steyra SVG, not arbitrary token SVGs.
function prepareSteyra(source: string, prefix: string) {
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  const root = doc.documentElement;
  const allowed = new Set(['svg', 'g', 'path', 'circle', 'defs', 'linearGradient', 'radialGradient', 'stop']);
  if (root.localName !== 'svg' || doc.querySelector('parsererror')) throw new Error('Invalid SVG');
  for (const node of [root, ...root.querySelectorAll('*')]) {
    if (node.namespaceURI !== SVG_NS || !allowed.has(node.localName)) throw new Error('Unexpected SVG element');
    for (const attr of node.attributes) {
      if (/^on/i.test(attr.name) || attr.localName === 'href' || /url\(\s*['"]?[^#\s'"]/i.test(attr.value)) {
        throw new Error('Unexpected SVG reference');
      }
    }
  }
  const eyes = root.querySelector<SVGGElement>('[id="eyes"]');
  if (!eyes || eyes.children.length !== 6) throw new Error('Expected six Steyra eyes');
  const bindings = [...eyes.children].map(element => {
    const group = element as SVGGElement;
    group.setAttribute('data-steyra-eye', group.id);
    const part = (name: string) => {
      const node = [...group.querySelectorAll<SVGGraphicsElement>('[id]')]
        .find(el => (el.getAttributeNS(SERIF_NS, 'id') ?? el.id) === name);
      if (!node) throw new Error(`Missing eye part: ${name}`);
      return node;
    };
    const eyeball = part('eyeball');
    const circle = eyeball.querySelector('circle');
    if (!circle) throw new Error('Eye opening is missing');
    const matrix = eyeball.transform.baseVal.consolidate()?.matrix;
    const radius = circle.r.baseVal.value * Math.hypot(matrix?.a ?? 1, matrix?.b ?? 0);
    if (!(radius > 0 && Number.isFinite(radius))) throw new Error('Invalid eye opening');
    const moving = ['iris-soft', 'iris', 'detail', 'pupil'].map(name => {
      let node = part(name);
      // Affinity adds a transformed wrapper around the iris detail; retain it.
      while (node.parentNode !== group) {
        if (!(node.parentNode instanceof SVGElement)) throw new Error('Invalid eye structure');
        node = node.parentNode as SVGGraphicsElement;
      }
      return node;
    });
    const glint = part('glint');
    const pupil = part('pupil').querySelector('circle');
    if (!pupil || !(pupil.r.baseVal.value > 0)) throw new Error('Pupil is missing');
    const pupilRadius = pupil.r.baseVal.value;
    const clip = doc.createElementNS(SVG_NS, 'clipPath');
    clip.id = `${group.id}-opening`;
    clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
    // clipPath requires a geometry child: browsers do not render a nested <g>
    // here. Carry the eyeball group's transform onto its circle instead.
    const opening = circle.cloneNode(true) as SVGCircleElement;
    opening.removeAttribute('id');
    opening.setAttribute('transform', eyeball.getAttribute('transform') ?? '');
    clip.appendChild(opening);
    root.querySelector('defs')!.appendChild(clip);
    const clipped = doc.createElementNS(SVG_NS, 'g');
    clipped.setAttribute('clip-path', `url(#${clip.id})`);
    clipped.setAttribute('data-steyra-eye-clip', '');
    const gaze = doc.createElementNS(SVG_NS, 'g');
    gaze.setAttribute('data-steyra-gaze', '');
    group.insertBefore(clipped, moving[0]);
    moving.forEach(node => gaze.appendChild(node));
    clipped.appendChild(gaze);
    const reflection = doc.createElementNS(SVG_NS, 'g');
    reflection.setAttribute('data-steyra-reflection', '');
    reflection.appendChild(glint);
    clipped.appendChild(reflection);
    return { group, gaze, reflection, radius, pupil, pupilRadius } satisfies Eye;
  });
  // Isolate all fragment IDs, including each eye opening and its gradients.
  const ids = new Map([...root.querySelectorAll('[id]')].map(el => [el.id, `${prefix}-${el.id}`]));
  for (const node of [root, ...root.querySelectorAll('*')]) {
    for (const attr of [...node.attributes]) {
      if (attr.name === 'id') node.id = ids.get(attr.value)!;
      else if (attr.value.includes('url(')) node.setAttributeNS(attr.namespaceURI, attr.name,
        attr.value.replace(/url\(#([^)]*)\)/g, (_, id: string) => `url(#${ids.get(id) ?? id})`));
    }
  }
  // The detailed body is displayed by the static WebP beneath this overlay.
  // Retain the exact ancestor transforms, but repaint only the six eyes.
  const full = eyes.parentElement!;
  for (const sibling of [...full.children]) if (sibling !== eyes) sibling.remove();
  root.setAttribute('aria-hidden', 'true');
  root.setAttribute('focusable', 'false');
  root.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  return { svg: root, eyes: bindings };
}

export function SteyraArtwork({ active, host, pose, head }: {
  active: boolean;
  host: RefObject<HTMLElement | null>;
  pose: RefObject<{ x: number; y: number }>;
  head: RefObject<HeadPose>;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const eyes = useRef<Eye[]>([]);
  const prefix = `steyra-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    const artwork = mount.current!.parentElement!;
    const sync = () => { artwork.style.animationPlayState = active && status === 'ready' && !document.hidden ? 'running' : 'paused'; };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => { document.removeEventListener('visibilitychange', sync); artwork.style.animationPlayState = 'paused'; };
  }, [active, status]);

  useEffect(() => {
    const controller = new AbortController();
    const container = mount.current!;
    setStatus('loading');
    async function load() {
      try {
        const response = await fetch('/assets/steyra-eyes.svg', { signal: controller.signal });
        if (!response.ok) throw new Error('Steyra could not load');
        const source = await response.text();
        if (controller.signal.aborted) return;
        const prepared = prepareSteyra(source, prefix);
        container.replaceChildren(prepared.svg);
        eyes.current = prepared.eyes;
        setStatus('ready');
      } catch {
        if (!controller.signal.aborted) setStatus('error');
      }
    }
    void load();
    return () => { controller.abort(); eyes.current = []; container.replaceChildren(); };
  }, [attempt, prefix]);

  useEffect(() => {
    const bindings = eyes.current;
    const targetHost = host.current;
    if (!bindings.length || !targetHost || status !== 'ready') return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const reset = () => {
      for (const binding of bindings) {
        binding.gaze.removeAttribute('transform');
        binding.reflection.removeAttribute('transform');
        binding.pupil.r.baseVal.value = binding.pupilRadius;
      }
    };
    const draw = () => {
      if (!active || document.hidden || reduced.matches) { reset(); return; }
      const input = head.current.tracked
        ? { x: head.current.x / .55, y: head.current.y / .4 }
        : pose.current;
      if (!Number.isFinite(input.x) || !Number.isFinite(input.y)) { reset(); return; }
      const length = Math.hypot(input.x, input.y);
      // Grow toward the card's neutral centre, shrink toward its edges. The
      // shared smoothed pose keeps dilation and gaze moving together.
      const pupilScale = 1.4 - .75 * Math.min(1, length);
      // Read all geometry before writing transforms, avoiding repeated layout
      // flushes between eyes. All eyes share the existing smoothed input.
      const matrices = bindings.map(binding => binding.group.getScreenCTM());
      bindings.forEach((binding, index) => {
        binding.pupil.r.baseVal.value = binding.pupilRadius * pupilScale;
        if (length < .001) {
          binding.gaze.removeAttribute('transform');
          binding.reflection.removeAttribute('transform');
          return;
        }
        const matrix = matrices[index];
        if (!matrix || Math.abs(matrix.a * matrix.d - matrix.b * matrix.c) < 1e-10) return;
        // Convert a screen-space direction into the mirrored source eye's coordinates.
        const inverse = matrix.inverse();
        const x = inverse.a * input.x + inverse.c * input.y;
        const y = inverse.b * input.x + inverse.d * input.y;
        const distance = binding.radius * .38 * Math.min(1, length);
        const factor = distance / Math.hypot(x, y);
        binding.gaze.setAttribute('transform', `translate(${(x * factor).toFixed(4)} ${(y * factor).toFixed(4)})`);
        // Art-directed reflection travel: preserve its authored offset and move
        // only a quarter as far as the iris, using the same smoothed input.
        binding.reflection.setAttribute('transform', `translate(${(x * factor * .25).toFixed(4)} ${(y * factor * .25).toFixed(4)})`);
      });
    };
    draw();
    if (!active) return reset;
    targetHost.addEventListener('inscape-tilt', draw);
    document.addEventListener('visibilitychange', draw);
    reduced.addEventListener('change', draw);
    window.addEventListener('resize', draw);
    return () => {
      targetHost.removeEventListener('inscape-tilt', draw);
      document.removeEventListener('visibilitychange', draw);
      reduced.removeEventListener('change', draw);
      window.removeEventListener('resize', draw);
      reset();
    };
  }, [active, status, host, pose, head]);

  return <div className="steyra-artwork" data-steyra-status={status}>
    <img className="steyra-body" src="/assets/steyra-960.webp" srcSet="/assets/steyra-480.webp 480w, /assets/steyra-960.webp 960w" sizes="(max-width: 600px) 100vw, 900px" alt="Steyra, a six-eyed creature by VXCTXR" draggable={false} />
    <div ref={mount} className="steyra-vector" aria-hidden="true" />
    {status === 'error' && <div className="steyra-recovery"><span role="status">Eye movement could not load.</span><button className="small-control" onClick={() => setAttempt(value => value + 1)}>Retry eye movement</button></div>}
  </div>;
}
