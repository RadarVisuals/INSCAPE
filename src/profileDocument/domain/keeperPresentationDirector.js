const DEFAULT_TIMER = Object.freeze({
  now: () => performance.now(),
  set: (callback, delay) => globalThis.setTimeout(callback, delay),
  clear: (timer) => globalThis.clearTimeout(timer)
});

export const KEEPER_PRESENTATION_CUES = Object.freeze(['lyx_received', 'lsp7_received', 'lsp8_received']);
const CUE_ALLOWLIST = new Set(KEEPER_PRESENTATION_CUES);

function normalizeSequence(sequence) {
  if (!Array.isArray(sequence) || sequence.length === 0) throw new TypeError('Keeper presentation requires at least one line');
  const ids = new Set();
  const normalized = sequence.map((entry) => {
    const id = typeof entry?.id === 'string' ? entry.id.trim() : '';
    const text = typeof entry?.text === 'string' ? entry.text.trim() : '';
    const atMs = Math.round(Number(entry?.atMs));
    const visibleForMs = Math.round(Number(entry?.visibleForMs));
    const cue = entry?.cue ?? null;
    if (!id || ids.has(id)) throw new TypeError('Keeper presentation line IDs must be unique');
    if (!text) throw new TypeError(`Keeper presentation line ${id} requires text`);
    if (!Number.isFinite(atMs) || atMs < 0) throw new TypeError(`Keeper presentation line ${id} has an invalid start time`);
    if (!Number.isFinite(visibleForMs) || visibleForMs < 500) throw new TypeError(`Keeper presentation line ${id} has an invalid duration`);
    if (cue !== null && !CUE_ALLOWLIST.has(cue)) throw new TypeError(`Keeper presentation cue ${cue} is not allowed`);
    ids.add(id);
    return Object.freeze({ id, text, atMs, visibleForMs, cue, dismissible: entry?.dismissible !== false });
  }).sort((left, right) => left.atMs - right.atMs || left.id.localeCompare(right.id));
  for (let index = 1; index < normalized.length; index += 1) {
    const previous = normalized[index - 1];
    if (previous.atMs + previous.visibleForMs > normalized[index].atMs) {
      throw new TypeError(`Keeper presentation lines ${previous.id} and ${normalized[index].id} overlap`);
    }
  }
  return Object.freeze(normalized);
}
function safelyInvoke(target, method, ...args) {
  try {
    const result = target?.[method]?.(...args);
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch {
    // Optional audio and visual cues never block the text timeline.
  }
}

export function createKeeperPresentationDirector({ sequence, timer = DEFAULT_TIMER, audio = null, onCue = null, reducedMotion = false } = {}) {
  const lines = normalizeSequence(sequence);
  const durationMs = Math.max(...lines.map((line) => line.atMs + line.visibleForMs));
  const listeners = new Set();
  const dismissed = new Set();
  const firedCues = new Set();
  const suspensionReasons = new Set();
  let started = false;
  let stopped = false;
  let completed = false;
  let muted = false;
  let elapsedBase = 0;
  let anchor = null;
  let pendingTimer = null;
  let snapshot = Object.freeze({ status: 'idle', elapsedMs: 0, currentLine: null, muted: false, userPaused: false });

  const now = () => Number(timer.now());
  const elapsed = () => Math.min(durationMs, elapsedBase + (anchor === null ? 0 : Math.max(0, now() - anchor)));
  const isPlaying = () => started && !stopped && !completed && suspensionReasons.size === 0;
  const status = () => {
    if (!started) return 'idle';
    if (stopped) return 'stopped';
    if (completed) return 'complete';
    return suspensionReasons.size > 0 ? 'paused' : 'playing';
  };
  const clearPendingTimer = () => {
    if (pendingTimer !== null) timer.clear(pendingTimer);
    pendingTimer = null;
  };
  const activeLineAt = (time) => lines.find((line) => !dismissed.has(line.id) && time >= line.atMs && time < line.atMs + line.visibleForMs) || null;
  const emit = (time) => {
    const nextStatus = status();
    snapshot = Object.freeze({
      status: nextStatus,
      elapsedMs: Math.round(time),
      currentLine: nextStatus === 'playing' || nextStatus === 'paused' ? activeLineAt(time) : null,
      muted,
      userPaused: suspensionReasons.has('user')
    });
    listeners.forEach((listener) => listener(snapshot));
  };
  const triggerDueCues = (time) => {
    if (reducedMotion) return;
    lines.forEach((line) => {
      if (!line.cue || firedCues.has(line.id) || time < line.atMs) return;
      firedCues.add(line.id);
      safelyInvoke({ cue: onCue }, 'cue', line.cue, line);
    });
  };
  const scheduleNext = (time) => {
    clearPendingTimer();
    if (!isPlaying()) return;
    const boundaries = [durationMs];
    lines.forEach((line) => boundaries.push(line.atMs, line.atMs + line.visibleForMs));
    const nextBoundary = boundaries.filter((boundary) => boundary > time).sort((a, b) => a - b)[0];
    if (nextBoundary !== undefined) pendingTimer = timer.set(refresh, Math.max(0, nextBoundary - time));
  };
  function refresh() {
    const time = elapsed();
    if (isPlaying()) triggerDueCues(time);
    if (isPlaying() && time >= durationMs) {
      elapsedBase = durationMs;
      anchor = null;
      completed = true;
      safelyInvoke(audio, 'stop');
    }
    emit(time);
    scheduleNext(time);
  }
  const beginPlayback = () => {
    anchor = now();
    safelyInvoke(audio, 'setMuted', muted);
    safelyInvoke(audio, 'play', elapsedBase);
  };
  const captureElapsed = () => {
    elapsedBase = elapsed();
    anchor = null;
  };
  const reset = () => {
    clearPendingTimer();
    started = true;
    stopped = false;
    completed = false;
    elapsedBase = 0;
    anchor = null;
    dismissed.clear();
    firedCues.clear();
    suspensionReasons.clear();
    beginPlayback();
    refresh();
  };

  return Object.freeze({
    start() {
      if (started && !stopped && !completed) return;
      reset();
    },
    restart() {
      safelyInvoke(audio, 'stop');
      reset();
    },
    pause(reason = 'user') {
      if (!isPlaying()) {
        suspensionReasons.add(reason);
        emit(elapsed());
        return;
      }
      captureElapsed();
      suspensionReasons.add(reason);
      clearPendingTimer();
      safelyInvoke(audio, 'pause');
      emit(elapsedBase);
    },
    resume(reason = 'user') {
      if (!started || stopped || completed) return;
      suspensionReasons.delete(reason);
      if (suspensionReasons.size === 0 && anchor === null) beginPlayback();
      refresh();
    },
    setHidden(hidden) {
      if (hidden) this.pause('hidden');
      else this.resume('hidden');
    },
    stop() {
      if (!started || stopped) return;
      captureElapsed();
      stopped = true;
      completed = false;
      suspensionReasons.clear();
      clearPendingTimer();
      safelyInvoke(audio, 'stop');
      emit(elapsedBase);
    },
    dismiss(lineId) {
      const line = lines.find((candidate) => candidate.id === lineId);
      if (!line?.dismissible) return;
      dismissed.add(lineId);
      refresh();
    },
    setMuted(nextMuted) {
      muted = nextMuted === true;
      safelyInvoke(audio, 'setMuted', muted);
      emit(elapsed());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return snapshot;
    },
    getSequence() {
      return lines;
    }
  });
}
