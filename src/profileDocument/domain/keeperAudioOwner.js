function noop() {}

export function createKeeperAudioOwner({ src = null, AudioCtor = globalThis.Audio } = {}) {
  if (!src || typeof AudioCtor !== 'function') return Object.freeze({ play: noop, pause: noop, stop: noop, setMuted: noop });
  const element = new AudioCtor(src);
  element.preload = 'metadata';
  element.loop = false;

  return Object.freeze({
    async play(elapsedMs = 0) {
      const targetSeconds = Math.max(0, Number(elapsedMs) || 0) / 1000;
      if (Math.abs((Number(element.currentTime) || 0) - targetSeconds) > 0.35) element.currentTime = targetSeconds;
      await element.play();
    },
    pause() {
      element.pause();
    },
    stop() {
      element.pause();
      element.currentTime = 0;
    },
    setMuted(muted) {
      element.muted = muted === true;
    }
  });
}
