import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

globalThis.navigator = { userAgent: '' };
globalThis.document = { createElement: () => ({ getContext: () => null }) };
const { PixiEngine } = await import('./PixiEngine.js');

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

function fakeApplication(init = async () => {}) {
  return {
    canvas: {},
    destroyCalls: 0,
    init,
    ticker: { add() {} },
    destroy() { this.destroyCalls += 1; }
  };
}

function createTestEngine({ app = fakeApplication(), state = { renderConfig: { marker: 'initial' } } } = {}) {
  const callbacks = [];
  const container = { appended: [], appendChild(node) { this.appended.push(node); } };
  const engine = new PixiEngine(container, {
    getState: () => state,
    subscribe: (_selector, callback) => { callbacks.push(callback); return () => {}; }
  }, { application: app });
  engine.resize = () => {};
  return { app, callbacks, container, engine, state };
}

test('Identity handoff uses only the existing Pixi application renderer and canvas', () => {
  const engineSource = readFileSync(new URL('./PixiEngine.js', import.meta.url), 'utf8');
  const canvasSource = readFileSync(new URL('../components/Canvas/ArtCanvas.jsx', import.meta.url), 'utf8');
  const actorSource = readFileSync(new URL('./entities/ActorEntity.js', import.meta.url), 'utf8');

  assert.equal(engineSource.match(/new Application\(/g)?.length, 1);
  assert.equal(canvasSource.match(/<canvas/g)?.length ?? 0, 0);
  assert.match(actorSource, /this\.renderer\.render\(\{/);
  assert.match(engineSource, /startResidentHandoff\(bounds, options = \{\}\)/);
  assert.match(engineSource, /this\.syncResidentHandoff\(\)/);
  assert.match(engineSource, /isResidentRepresentedByAvatar\(\)/);
  assert.match(engineSource, /updateHorizontalMove\(clientX, direction = 0\)/);
  assert.match(engineSource, /toGlobal\(this\.actor\.container\.position\)/);
  assert.match(engineSource, /residentHandoff\.residentFacing = intendedDirection/);
  assert.match(engineSource, /moveTo\(localTarget\.x, this\.actor\.targetPosition\.y\)/);
  assert.match(engineSource, /backgroundAlpha: 0,[\s\S]*backgroundColor: 0x000000/);
  assert.doesNotMatch(engineSource, /setResidentHabitat|syncResidentHabitat/);
});

test('screen-position movement preserves smooth defaults and supports reduced-motion placement', () => {
  const { engine } = createTestEngine();
  engine.masterContainer = { toLocal: ({ x, y }) => ({ x: x / 2, y: y / 2 }) };
  engine.actor = {
    baselinePosition: { x: 1, y: 2 },
    targetPosition: { x: 1, y: 2 },
    isMovingToTarget: false,
    moveTo(x, y) { this.targetPosition = { x, y }; this.isMovingToTarget = true; },
  };
  engine.updateMouseClick(100, 80);
  assert.deepEqual(engine.actor.targetPosition, { x: 50, y: 40 });
  assert.deepEqual(engine.actor.baselinePosition, { x: 1, y: 2 });
  assert.equal(engine.actor.isMovingToTarget, true);
  engine.updateMouseClick(110, 90, { continuous: true, speedMultiplier: 1.55 });
  assert.deepEqual(engine.actor.targetPosition, { x: 55, y: 45 });
  engine.updateMouseClick(120, 100, { reducedMotion: true });
  assert.deepEqual(engine.actor.targetPosition, { x: 60, y: 50 });
  assert.deepEqual(engine.actor.baselinePosition, { x: 60, y: 50 });
  assert.equal(engine.actor.isMovingToTarget, false);
});

test('destroy during asynchronous initialization releases Pixi and prevents scene installation', async () => {
  globalThis.window = { innerWidth: 1200, innerHeight: 800 };
  const loading = deferred();
  const enteredLoad = deferred();
  const setup = createTestEngine();
  let sceneInstallations = 0;
  setup.engine.loadAssets = async () => { enteredLoad.resolve(); await loading.promise; };
  setup.engine.buildSceneGraph = () => { sceneInstallations += 1; };

  const initialization = setup.engine.init();
  await enteredLoad.promise;
  setup.engine.destroy();
  loading.resolve();
  assert.equal(await initialization, false);
  assert.equal(setup.app.destroyCalls, 1);
  assert.equal(sceneInstallations, 0);
});

test('destroy while the Pixi application is initializing defers one safe teardown', async () => {
  globalThis.window = { innerWidth: 1200, innerHeight: 800 };
  const appInitialization = deferred();
  const app = fakeApplication(() => appInitialization.promise);
  const setup = createTestEngine({ app });
  let sceneInstallations = 0;
  setup.engine.loadAssets = async () => {};
  setup.engine.buildSceneGraph = () => { sceneInstallations += 1; };

  const initialization = setup.engine.init();
  await Promise.resolve();
  setup.engine.destroy();
  assert.equal(app.destroyCalls, 0);
  appInitialization.resolve();
  assert.equal(await initialization, false);
  assert.equal(app.destroyCalls, 1);
  assert.equal(setup.container.appended.length, 0);
  assert.equal(sceneInstallations, 0);
});

test('destroy is idempotent after initialization', async () => {
  globalThis.window = { innerWidth: 1200, innerHeight: 800 };
  const setup = createTestEngine();
  setup.engine.loadAssets = async () => {};
  setup.engine.buildSceneGraph = () => {};
  assert.equal(await setup.engine.init(), true);
  setup.engine.destroy();
  setup.engine.destroy();
  assert.equal(setup.app.destroyCalls, 1);
});

test('configuration updates during initialization stay serial and install the latest configuration', async () => {
  globalThis.window = { innerWidth: 1200, innerHeight: 800 };
  const firstLoad = deferred();
  const enteredFirstLoad = deferred();
  const setup = createTestEngine();
  const seenConfigurations = [];
  let activeLoads = 0;
  let maximumActiveLoads = 0;
  let sceneInstallations = 0;
  setup.engine.loadAssets = async () => {
    activeLoads += 1;
    maximumActiveLoads = Math.max(maximumActiveLoads, activeLoads);
    seenConfigurations.push(setup.state.renderConfig.marker);
    if (seenConfigurations.length === 1) { enteredFirstLoad.resolve(); await firstLoad.promise; }
    activeLoads -= 1;
  };
  setup.engine.buildSceneGraph = () => { sceneInstallations += 1; };

  const initialization = setup.engine.init();
  await enteredFirstLoad.promise;
  setup.state.renderConfig = { marker: 'latest' };
  setup.callbacks[0]();
  firstLoad.resolve();

  assert.equal(await initialization, true);
  assert.equal(maximumActiveLoads, 1);
  assert.deepEqual(seenConfigurations, ['initial', 'latest']);
  assert.equal(sceneInstallations, 1);
  setup.engine.destroy();
});
