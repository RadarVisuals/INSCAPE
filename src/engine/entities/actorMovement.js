export function moveActorTo(actor, localX, localY, options = {}) {
  if (actor.movementBounds && actor.areMovementBoundsActive) {
    localX = Math.max(actor.movementBounds.left, Math.min(actor.movementBounds.right, localX));
    localY = Math.max(actor.movementBounds.top, Math.min(actor.movementBounds.bottom, localY));
  }
  actor.targetPosition.x = localX;
  actor.targetPosition.y = localY;
  actor.targetMovementSpeedMultiplier = Math.max(0.25, Math.min(3, Number(options.speedMultiplier) || 1));
  actor.targetMovementContinuous = options.continuous === true;
  actor.isMovingToTarget = true;
}

export function isActorWithinMovementBounds(actor, position) {
  return !!actor.movementBounds &&
    position.x >= actor.movementBounds.left &&
    position.x <= actor.movementBounds.right &&
    position.y >= actor.movementBounds.top &&
    position.y <= actor.movementBounds.bottom;
}

export function setActorMovementBounds(actor, bounds, options = {}) {
  const { reducedMotion = false, returnPosition = null } = options || {};
  if (!actor.movementBounds) {
    actor.preBoundPosition = returnPosition
      ? { ...returnPosition }
      : { ...actor.baselinePosition };
  }
  const nextBounds = { ...bounds };
  const boundsChanged = !actor.movementBounds || Object.keys(nextBounds).some(
    (key) => Math.abs(nextBounds[key] - actor.movementBounds[key]) > 0.01
  );
  actor.movementBounds = nextBounds;
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;

  if (reducedMotion) {
    actor.baselinePosition.x = centerX;
    actor.baselinePosition.y = centerY;
    actor.targetPosition.x = centerX;
    actor.targetPosition.y = centerY;
    actor.isMovingToTarget = false;
    actor.isEnteringMovementBounds = false;
    actor.areMovementBoundsActive = true;
    return;
  }

  const isInside = isActorWithinMovementBounds(actor, actor.baselinePosition);
  actor.areMovementBoundsActive = isInside;
  actor.isEnteringMovementBounds = !isInside;
  if (boundsChanged && !isInside) {
    actor.targetPosition.x = centerX;
    actor.targetPosition.y = centerY;
    actor.isMovingToTarget = true;
  } else if (isInside && actor.isMovingToTarget) {
    actor.targetPosition.x = Math.max(bounds.left, Math.min(bounds.right, actor.targetPosition.x));
    actor.targetPosition.y = Math.max(bounds.top, Math.min(bounds.bottom, actor.targetPosition.y));
  }
}

export function clearActorMovementBounds(actor, options = {}) {
  const { reducedMotion = false } = options || {};
  const returnPosition = actor.preBoundPosition;
  actor.movementBounds = null;
  actor.preBoundPosition = null;
  actor.isEnteringMovementBounds = false;
  actor.areMovementBoundsActive = false;
  if (!returnPosition) return;

  if (reducedMotion) {
    actor.baselinePosition.x = returnPosition.x;
    actor.baselinePosition.y = returnPosition.y;
    actor.targetPosition.x = returnPosition.x;
    actor.targetPosition.y = returnPosition.y;
    actor.isMovingToTarget = false;
    return;
  }
  moveActorTo(actor, returnPosition.x, returnPosition.y);
}

export function updateActorTargetMovement(actor, deltaTime) {
  if (!actor.isMovingToTarget) return;

  const dx = actor.targetPosition.x - actor.baselinePosition.x;
  const dy = actor.targetPosition.y - actor.baselinePosition.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  const safeDeltaTime = Math.max(0, deltaTime) * Math.max(0.25, Math.min(3, actor.targetMovementSpeedMultiplier || 1));
  const easedStep = dist * 0.02 * safeDeltaTime;
  // Keep the eased arrival from lingering at an almost imperceptible speed.
  // Three pixels per frame is small enough to avoid the old 15px snap while
  // letting the continuously running idle motion take over promptly.
  const finishingStep = (actor.targetMovementContinuous ? 0.55 : 3) * safeDeltaTime;
  const stepDistance = Math.min(dist, Math.max(easedStep, finishingStep));

  if (dist === 0 || stepDistance >= dist) {
    actor.baselinePosition.x = actor.targetPosition.x;
    actor.baselinePosition.y = actor.targetPosition.y;
    actor.isMovingToTarget = false;
  } else {
    const stepRatio = stepDistance / dist;
    actor.baselinePosition.x += dx * stepRatio;
    actor.baselinePosition.y += dy * stepRatio;
    actor.facingDirection = dx > 0 ? 1.0 : -1.0;
  }

  if (actor.isEnteringMovementBounds && isActorWithinMovementBounds(actor, actor.baselinePosition)) {
    actor.isEnteringMovementBounds = false;
    actor.areMovementBoundsActive = true;
  }
}
