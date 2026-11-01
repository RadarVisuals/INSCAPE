import { gridRailTransform } from './gridRail.js';
import { gridLanding } from './gridMomentum.js';

export const GRID_PLAYBACK_SLIDE_MS = 12000;
// Renew well before this horizon, independently of Grid boundaries. One run
// covers an hour without per-Grid animation restarts or ever-growing keyframes.
const PLAY_HORIZON = 60 * 60 * 1000;
const playTrajectory = {
  duration: PLAY_HORIZON, distance: -PLAY_HORIZON / GRID_PLAYBACK_SLIDE_MS, easing: 'linear',
  sample(time) { return { distance: -time / GRID_PLAYBACK_SLIDE_MS, velocity: -1 / GRID_PLAYBACK_SLIDE_MS, done: false }; },
};

// This Display's native animation is the motion clock and transform owner.
// React may update navigation/content while the compositor continues its run.
// Drag/hold has no animation: taking control samples and cancels this owner.
export function createGridCameraTransport(node, position, kind, velocity = 0) {
  const trajectory = kind === 'play' ? playTrajectory : gridLanding(position, velocity);
  const destination = trajectory.target ?? position + trajectory.distance;
  if (destination === position) return null;
  const animation = node.animate([
    { transform: gridRailTransform(position) },
    { transform: gridRailTransform(destination) },
  ], { duration: trajectory.duration, easing: trajectory.easing, fill: 'both' });
  // Use the document clock immediately so input takeover and the first visual
  // frame refer to the same point, including before the ready promise settles.
  if (node.ownerDocument.timeline.currentTime !== null) animation.startTime = node.ownerDocument.timeline.currentTime;
  let cancelled = false;
  const followers = new Set();
  const sample = () => {
    const time = Math.max(0, Math.min(trajectory.duration, Number(animation.currentTime) || 0));
    const state = trajectory.sample(time);
    return { ...state, position: state.done ? destination : position + state.distance, renew: kind === 'play' && time > PLAY_HORIZON - 5000 };
  };
  return { kind, animation, sample,
    // Scene-linked Text observes this same trajectory and clock. Its local
    // page origin differs from the Display rail, so it supplies that mapping.
    follow(target, transform) {
      const follower = target.animate([
        { transform: transform(position) },
        { transform: transform(destination) },
      ], { duration: trajectory.duration, easing: trajectory.easing, fill: 'both' });
      if (animation.startTime !== null) follower.startTime = animation.startTime;
      else follower.currentTime = animation.currentTime;
      const stop = () => {
        if (!followers.delete(stop)) return;
        target.style.transform = transform(sample().position);
        follower.cancel();
      };
      followers.add(stop);
      return stop;
    },
    cancel() {
      if (cancelled) return;
      const state = sample();
      for (const stop of [...followers]) stop();
      node.style.transform = gridRailTransform(state.position);
      animation.cancel(); cancelled = true;
    },
  };
}
