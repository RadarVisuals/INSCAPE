import assert from 'node:assert/strict';
import test from 'node:test';
import { createKeeperPresentationDirector } from './keeperPresentationDirector.js';

function createFakeTimer() {
  let time = 0;
  let nextId = 1;
  const tasks = new Map();
  const timer = {
    now: () => time,
    set(callback, delay) {
      const id = nextId++;
      tasks.set(id, { at: time + delay, callback });
      return id;
    },
    clear(id) {
      tasks.delete(id);
    }
  };
  return {
    timer,
    advance(milliseconds) {
      const destination = time + milliseconds;
      while (true) {
        const due = [...tasks.entries()].filter(([, task]) => task.at <= destination).sort((left, right) => left[1].at - right[1].at || left[0] - right[0])[0];
        if (!due) break;
        const [id, task] = due;
        tasks.delete(id);
        time = task.at;
        task.callback();
      }
      time = destination;
    },
    pending: () => tasks.size
  };
}

const sequence = [
  { id: 'one', text: 'First', atMs: 1000, visibleForMs: 2000, cue: 'lyx_received' },
  { id: 'two', text: 'Second', atMs: 4000, visibleForMs: 2000 }
];

test('presentation ordering is deterministic and completes on the presentation clock', () => {
  const clock = createFakeTimer();
  const cues = [];
  const director = createKeeperPresentationDirector({ sequence, timer: clock.timer, onCue: (cue) => cues.push(cue) });
  director.start();
  assert.equal(director.getSnapshot().currentLine, null);
  clock.advance(1000);
  assert.equal(director.getSnapshot().currentLine.id, 'one');
  assert.deepEqual(cues, ['lyx_received']);
  clock.advance(2000);
  assert.equal(director.getSnapshot().currentLine, null);
  clock.advance(1000);
  assert.equal(director.getSnapshot().currentLine.id, 'two');
  clock.advance(2000);
  assert.equal(director.getSnapshot().status, 'complete');
  assert.equal(clock.pending(), 0);
});
test('hidden and user pauses compose without advancing or prematurely resuming', () => {
  const clock = createFakeTimer();
  const director = createKeeperPresentationDirector({ sequence, timer: clock.timer });
  director.start();
  clock.advance(1500);
  director.pause('user');
  director.setHidden(true);
  clock.advance(8000);
  assert.equal(director.getSnapshot().elapsedMs, 1500);
  assert.equal(director.getSnapshot().currentLine.id, 'one');
  director.setHidden(false);
  assert.equal(director.getSnapshot().status, 'paused');
  director.resume('user');
  clock.advance(1500);
  assert.equal(director.getSnapshot().elapsedMs, 3000);
  assert.equal(director.getSnapshot().currentLine, null);
});

test('dismissing a line does not seek the clock or suppress later lines', () => {
  const clock = createFakeTimer();
  const director = createKeeperPresentationDirector({ sequence, timer: clock.timer });
  director.start();
  clock.advance(1200);
  director.dismiss('one');
  assert.equal(director.getSnapshot().elapsedMs, 1200);
  assert.equal(director.getSnapshot().currentLine, null);
  clock.advance(2800);
  assert.equal(director.getSnapshot().currentLine.id, 'two');
});

test('stop cleans timers and restart resets dismissed lines and cue delivery', () => {
  const clock = createFakeTimer();
  const cues = [];
  const director = createKeeperPresentationDirector({ sequence, timer: clock.timer, onCue: (cue) => cues.push(cue) });
  director.start();
  clock.advance(1200);
  director.dismiss('one');
  director.stop();
  assert.equal(clock.pending(), 0);
  assert.equal(director.getSnapshot().status, 'stopped');
  director.restart();
  clock.advance(1000);
  assert.equal(director.getSnapshot().currentLine.id, 'one');
  assert.deepEqual(cues, ['lyx_received', 'lyx_received']);
});

test('reduced motion retains text while suppressing visual cues', () => {
  const clock = createFakeTimer();
  const cues = [];
  const director = createKeeperPresentationDirector({ sequence, timer: clock.timer, onCue: (cue) => cues.push(cue), reducedMotion: true });
  director.start();
  clock.advance(1000);
  assert.equal(director.getSnapshot().currentLine.text, 'First');
  assert.deepEqual(cues, []);
});

test('optional audio failures never interrupt text, mute, or cleanup', async () => {
  const clock = createFakeTimer();
  const calls = [];
  const audio = {
    play() { calls.push('play'); return Promise.reject(new Error('blocked')); },
    pause() { calls.push('pause'); },
    stop() { calls.push('stop'); },
    setMuted(value) { calls.push(`muted:${value}`); }
  };
  const director = createKeeperPresentationDirector({ sequence, timer: clock.timer, audio });
  director.start();
  director.setMuted(true);
  clock.advance(1000);
  await Promise.resolve();
  assert.equal(director.getSnapshot().currentLine.text, 'First');
  assert.equal(director.getSnapshot().muted, true);
  director.stop();
  assert.deepEqual(calls, ['muted:false', 'play', 'muted:true', 'stop']);
});

test('invalid, overlapping, and non-allowlisted presentation input fails closed', () => {
  assert.throws(() => createKeeperPresentationDirector({ sequence: [] }), /at least one line/);
  assert.throws(() => createKeeperPresentationDirector({ sequence: [
    { id: 'one', text: 'First', atMs: 0, visibleForMs: 2000 },
    { id: 'two', text: 'Second', atMs: 1000, visibleForMs: 2000 }
  ] }), /overlap/);
  assert.throws(() => createKeeperPresentationDirector({ sequence: [
    { id: 'one', text: 'First', atMs: 0, visibleForMs: 2000, cue: 'swap_actor' }
  ] }), /not allowed/);
});
