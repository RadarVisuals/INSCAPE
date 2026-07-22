import assert from 'node:assert/strict';
import test from 'node:test';
import { createKeeperAudioOwner } from './keeperAudioOwner.js';

test('missing audio remains a safe no-op owner', async () => {
  const audio = createKeeperAudioOwner({ src: null, AudioCtor: undefined });
  await audio.play(4000);
  audio.pause();
  audio.setMuted(true);
  audio.stop();
});
test('audio owner follows presentation position, mute, pause, and stop', async () => {
  let instance;
  class FakeAudio {
    constructor(src) {
      this.src = src;
      this.currentTime = 0;
      this.muted = false;
      this.calls = [];
      instance = this;
    }
    play() { this.calls.push('play'); return Promise.resolve(); }
    pause() { this.calls.push('pause'); }
  }
  const audio = createKeeperAudioOwner({ src: '/proof.mp3', AudioCtor: FakeAudio });
  await audio.play(4200);
  assert.equal(instance.currentTime, 4.2);
  audio.setMuted(true);
  assert.equal(instance.muted, true);
  audio.pause();
  audio.stop();
  assert.equal(instance.currentTime, 0);
  assert.deepEqual(instance.calls, ['play', 'pause', 'pause']);
});
