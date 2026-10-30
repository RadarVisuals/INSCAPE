import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import childProcess, { spawn } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { randomUUID } from 'node:crypto';
import { runOwnedCommand, requireSuccessfulCommand } from './verificationProcess.mjs';
import { createOwnedProcessTree, resolveWindowsProcessRuntime } from '../browser-tests/browser-test-lifecycle.mjs';

const run = options => runOwnedCommand({ cwd: process.cwd(), env: process.env, stdio: 'ignore', timeoutMs: 15_000, ...options });
const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } };
async function treeFixture(t, { exitAfter } = {}) {
  const output = await mkdtemp(resolve(tmpdir(), 'inscape-process-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const target = resolve(output, 'pids.json');
  const source = `const {spawn}=require('node:child_process'); const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',windowsHide:true,detached:${Boolean(exitAfter)}}); child.unref();
    require('node:fs').writeFileSync(${JSON.stringify(target)},JSON.stringify({root:process.pid,child:child.pid}));
    ${exitAfter ? `setTimeout(()=>process.exit(0),${exitAfter})` : 'setInterval(()=>{},1000)'};`;
  return { args: ['-e', source], pids: async () => JSON.parse(await readFile(target, 'utf8')) };
}

test('normal command success and crash status remain distinct', { timeout: 30_000 }, async () => {
  requireSuccessfulCommand(await run({ args: ['-e', 'void 0'] }), 'normal');
  const crashed = await run({ args: ['-e', 'process.exit(7)'] });
  assert.equal(crashed.code, 7); assert.throws(() => requireSuccessfulCommand(crashed, 'crash'));
});

test('owned commands pin the declared Windows runtime into child environments', { timeout: 30_000 }, async () => {
  const env = { ...process.env, INSCAPE_PROCESS_POWERSHELL: '' };
  const runtime = await resolveWindowsProcessRuntime(env);
  const expected = runtime?.executable || '';
  requireSuccessfulCommand(await run({ env, args: ['-e', `require('node:assert/strict').equal(process.env.INSCAPE_PROCESS_POWERSHELL,${JSON.stringify(expected)})`] }), 'pinned inventory runtime');
});

test('periodic inventory stays bounded while completion queues a fresh checkpoint', { timeout: 30_000 }, async t => {
  const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
  const payloadReady = deferred(), intervalReady = deferred(), periodicStarted = deferred(), completionSeen = deferred();
  const releasePeriodic = deferred(), nextStarted = deferred(), releaseNext = deferred();
  const originalSpawn = childProcess.spawn, originalSetInterval = globalThis.setInterval;
  let child, childClosed, running, interval, tick, observations = 0;
  const spawnMock = t.mock.method(childProcess, 'spawn', (...args) => {
    child = originalSpawn(...args);
    childClosed = new Promise(resolve => child.once('close', resolve));
    child.on('message', message => {
      if (message?.type === 'payload-ready') payloadReady.resolve();
      if (message?.type === 'inscape-verification-gate' && message.phase === 'complete') completionSeen.resolve();
    });
    return child;
  });
  syncBuiltinESMExports();
  const intervalMock = t.mock.method(globalThis, 'setInterval', callback => {
    tick = callback; interval = originalSetInterval(() => {}, 60_000); intervalReady.resolve(); return interval;
  });
  t.after(async () => {
    releasePeriodic.resolve(); releaseNext.resolve(); clearInterval(interval);
    if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await childClosed; await running?.catch(() => {});
    spawnMock.mock.restore(); intervalMock.mock.restore(); syncBuiltinESMExports();
  });
  running = run({ args: ['-e', `const hold=setInterval(()=>{},1000);
    function finish(message){if(message?.finish){clearInterval(hold);process.off('message',finish);}}
    process.on('message',finish);process.send({type:'payload-ready'});`], createTree: ({ rootPid }) => ({
    ownedPids: () => [rootPid],
    observe: async () => {
      observations++;
      if (observations === 2) { periodicStarted.resolve(); await releasePeriodic.promise; }
      if (observations === 3) { nextStarted.resolve(); await releaseNext.promise; }
      return [{ pid: rootPid }];
    },
    waitForExit: async () => [],
    forceTerminate: async () => { assert.fail('Successful fixture must not require forced termination'); }
  }) });
  await Promise.all([payloadReady.promise, intervalReady.promise]);
  tick(); await periodicStarted.promise;
  for (let index = 0; index < 10; index++) tick();
  child.send({ finish: true }); await completionSeen.promise;
  releasePeriodic.resolve(); await nextStarted.promise;
  releaseNext.resolve();
  requireSuccessfulCommand(await running, 'bounded periodic inventory');
  assert.equal(observations, 3, 'Only startup, one periodic inventory, and a fresh completion inventory should run');
});

test('watchdog stops only its live owned process tree and cannot pass', { timeout: 30_000 }, async t => {
  const fixture = await treeFixture(t);
  const result = await run({ args: fixture.args, timeoutMs: 1500 });
  assert.equal(result.timeout, true); assert.throws(() => requireSuccessfulCommand(result, 'watchdog'));
  for (const pid of Object.values(await fixture.pids())) assert.equal(alive(pid), false, `Owned PID ${pid} remains`);
});

test('abort waits for the owned child tree to exit and keeps interruption explicit', { timeout: 30_000 }, async t => {
  const fixture = await treeFixture(t), controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const result = await run({ args: fixture.args, signal: controller.signal });
    assert.equal(result.interrupted, true); assert.throws(() => requireSuccessfulCommand(result, 'abort'));
    for (const pid of Object.values(await fixture.pids())) assert.equal(alive(pid), false);
  } finally { clearTimeout(timer); }
});

test('an observed child is cleaned even after its short-lived root exits successfully', { timeout: 30_000 }, async t => {
  const fixture = await treeFixture(t, { exitAfter: 3000 });
  const observations = [];
  const result = await run({ args: fixture.args, createTree: options => {
    const tree = createOwnedProcessTree(options);
    return { ...tree, observe: async () => { const entries = await tree.observe(); observations.push({ entries, owned: tree.ownedPids() }); return entries; } };
  } });
  const observedChild = (await fixture.pids()).child;
  assert.ok(observations.some(observation => observation.owned.includes(observedChild)));
  assert.equal(result.code, 0); assert.throws(() => requireSuccessfulCommand(result, 'leaked child'));
  assert.ok(result.cleanup.errors.some(message => message.includes('left owned subprocesses')));
  for (const pid of Object.values(await fixture.pids())) assert.equal(alive(pid), false);
});

test('inventory failure stays unknown instead of claiming proven cleanup', { timeout: 30_000 }, async () => {
  await assert.rejects(run({ args: ['-e', 'void 0'], createTree: options => {
    const tree = createOwnedProcessTree(options);
    return { ...tree, observe: async () => { throw Error('simulated inventory unavailable'); } };
  } }), /root creation identity was not observed/);
});

test('short normal completion observes and removes a detached child before accepting exit', { timeout: 30_000 }, async t => {
  const output = await mkdtemp(resolve(tmpdir(), 'inscape-quick-process-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const target = resolve(output, 'child.json');
  const result = await run({ args: ['-e', `const {spawn}=require('node:child_process');
    const child=spawn(process.execPath,['-e','setTimeout(()=>{},7000)'],{detached:true,stdio:'ignore',windowsHide:true});child.unref();
    require('node:fs').writeFileSync(${JSON.stringify(target)},String(child.pid));`] });
  const pid = Number(await readFile(target, 'utf8'));
  assert.equal(result.code, 0); assert.equal(result.cleanup.checkpoints.complete, true);
  assert.equal(alive(pid), false); assert.throws(() => requireSuccessfulCommand(result, 'quick detached child'));
});

test('explicit exit zero without a completion inventory is never verified', { timeout: 30_000 }, async () => {
  const result = await run({ args: ['-e', 'process.exit(0)'] });
  assert.equal(result.code, 0); assert.equal(result.cleanup.status, 'unknown');
  assert.equal(result.cleanup.checkpoints.complete, false); assert.throws(() => requireSuccessfulCommand(result, 'abrupt exit zero'));
});

test('nested Node test workers do not inherit a blocking parent handshake', { timeout: 30_000 }, async t => {
  const output = await mkdtemp(resolve(tmpdir(), 'inscape-process-test-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const source = resolve(output, 'nested.test.mjs');
  await writeFile(source, "import test from 'node:test'; import assert from 'node:assert/strict'; test('nested',()=>assert.equal(1,1));");
  const result = await run({ args: ['--test', '--test-reporter=tap', source] });
  requireSuccessfulCommand(result, 'nested test');
});

test('timeout termination failure never passes even when direct-child fallback exits', { timeout: 30_000 }, async () => {
  const result = await run({ args: ['-e', 'setInterval(()=>{},1000)'], timeoutMs: 500,
    createTree: options => ({ ...createOwnedProcessTree(options), forceTerminate: async () => { throw Error('simulated termination failure'); } }) });
  assert.equal(result.timeout, true); assert.equal(result.cleanup.status, 'unknown');
  assert.ok(result.cleanup.errors.includes('simulated termination failure'));
  assert.throws(() => requireSuccessfulCommand(result, 'failed termination'));
});

test('unexpected direct-parent disconnect stops the payload with failure', { timeout: 15_000 }, async t => {
  const nonce = randomUUID();
  const env = { ...process.env, INSCAPE_VERIFY_GATE_NONCE: nonce, INSCAPE_VERIFY_PARENT_PID: String(process.pid) };
  delete env.NODE_TEST_CONTEXT; delete env.NODE_TEST_WORKER_ID;
  const child = spawn(process.execPath, ['--import', new URL('./verificationProcessGate.mjs', import.meta.url).href,
    '-e', "process.send({payloadStarted:true}); setInterval(()=>{},1000)"], {
    env,
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  const exited = new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', (code, signal) => resolve({ code, signal })); });
  child.on('message', message => {
    if (message.phase === 'start' && message.nonce === nonce) child.send({ type: 'inscape-verification-ack', phase: 'start', nonce });
    if (message.payloadStarted) child.disconnect();
  });
  assert.deepEqual(await exited, { code: 1, signal: null });
});
