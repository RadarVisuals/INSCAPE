export const KEEPER_POINTER_FOLLOW_SPEEDS = Object.freeze({
  slow: 0.62,
  normal: 1,
  fast: 1.55,
});

export function keeperPointerFollowSpeedMultiplier(speed) {
  return KEEPER_POINTER_FOLLOW_SPEEDS[speed] || KEEPER_POINTER_FOLLOW_SPEEDS.normal;
}

export function keeperPointerFollowAllowed({
  arrangeEnabled = false,
  browserOpen = false,
  cameraGestureActive = false,
  compositionPreview = null,
  cropModeActive = false,
  gestureActive = false,
  identityActive = false,
  interfaceVisible = true,
  keeperDockActive = false,
  followCursor = true,
  settling = false,
  themeOpen = false,
  viewerActive = false,
} = {}) {
  return interfaceVisible === true
    && followCursor === true
    && arrangeEnabled !== true
    && keeperDockActive !== true
    && browserOpen !== true
    && themeOpen !== true
    && identityActive !== true
    && viewerActive !== true
    && gestureActive !== true
    && cameraGestureActive !== true
    && cropModeActive !== true
    && !compositionPreview
    && settling !== true;
}

export function keeperPointerTarget(event, bounds) {
  if (!event || event.pointerType === 'touch' || event.isPrimary === false || Number(event.buttons || 0) !== 0) return null;
  const clientX = Number(event.clientX);
  const clientY = Number(event.clientY);
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
  if (bounds && (clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom)) return null;
  return Object.freeze({ clientX, clientY });
}

export function createKeeperPointerFollowScheduler(move, {
  cancelFrame = (frame) => cancelAnimationFrame(frame),
  requestFrame = (callback) => requestAnimationFrame(callback),
} = {}) {
  let frame = null;
  let latestTarget = null;

  const cancel = () => {
    latestTarget = null;
    if (frame !== null) cancelFrame(frame);
    frame = null;
  };

  return Object.freeze({
    cancel,
    push(target) {
      if (!target) return;
      latestTarget = target;
      if (frame !== null) return;
      frame = requestFrame(() => {
        frame = null;
        const nextTarget = latestTarget;
        latestTarget = null;
        if (nextTarget) move(nextTarget.clientX, nextTarget.clientY);
      });
    },
  });
}
