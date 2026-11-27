import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  OWNER_PREVIEW_DIAGNOSTIC_MARGIN_MS,
  OWNER_PREVIEW_GATE_WATCHDOG_MS,
  OWNER_PREVIEW_LIFECYCLE_TIMEOUTS,
  OWNER_PRODUCTION_PREVIEW_PROFILE,
  OWNER_PRODUCTION_PREVIEW_URL,
  TASK4A_HARDWARE_EDGE_ARGS,
  assertTask4HardwareRenderer,
  classifyTask4Renderer,
  classifySyntheticProfileMetadataRpc,
  createGateOperationTracker,
  createOwnerProductionPreviewFixtureHtml,
  createOwnerPreviewLedger,
  createPhaseDeadline,
  ownerChannelAuthorityAllowed,
  runPostSetupGateWithCleanup,
} from './owner-production-preview-harness.mjs';

const rendererEvidence = (renderer, vendor = 'GPU vendor') => ({
  webgl: { available: true, unmaskedVendor: vendor, unmaskedRenderer: renderer },
  webgl2: { available: true, unmaskedVendor: vendor, unmaskedRenderer: renderer },
  navigatorGpu: true,
});

test('Task 4A lifecycle budgets remain phase-specific and bounded', () => {
  assert.deepEqual(OWNER_PREVIEW_LIFECYCLE_TIMEOUTS, {
    entryReadyMs: 30_000,
    connectAuthorityMs: 10_000,
    startveilRevealMs: 60_000,
    ownerReadyMs: 10_000,
    themeSettingsMs: 30_000,
  });
  assert.equal(OWNER_PREVIEW_GATE_WATCHDOG_MS,
    Object.values(OWNER_PREVIEW_LIFECYCLE_TIMEOUTS).reduce((total, value) => total + value, 0)
      + OWNER_PREVIEW_DIAGNOSTIC_MARGIN_MS,
  'Post-setup watchdog must be derived only from phase budgets and the fixed diagnostic margin');
});

test('Task 4A uses a dedicated hardware argument list without renderer forcing', async () => {
  assert.deepEqual(TASK4A_HARDWARE_EDGE_ARGS, [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-component-update',
    '--disable-background-networking',
    '--disk-cache-size=1',
    '--media-cache-size=1',
  ]);
  assert.equal(TASK4A_HARDWARE_EDGE_ARGS.some((argument) =>
    /disable-gpu|use-angle|swiftshader|llvmpipe|lavapipe|software renderer/iu.test(argument)), false);
  const source = await readFile(new URL('./owner-production-preview-harness.mjs', import.meta.url), 'utf8');
  assert.match(source, /browserArgs = TASK4A_HARDWARE_EDGE_ARGS/u);
  assert.doesNotMatch(source, /browserArgs = TASK4A_CURRENT_EDGE_ARGS/u);
});

test('Task 4A renderer preflight accepts real GPUs without vendor hardcoding', () => {
  for (const [vendor, renderer] of [
    ['Google Inc. (Intel)', 'ANGLE (Intel, Intel Iris Xe, Direct3D11)'],
    ['Google Inc. (AMD)', 'ANGLE (AMD, Radeon RX 6800, Direct3D11)'],
    ['Apple Inc.', 'Apple M3'],
  ]) {
    assert.deepEqual(classifyTask4Renderer(rendererEvidence(renderer, vendor)), {
      classification: 'hardware', hardwareAccelerated: true, softwareMatches: [],
    });
    assert.equal(assertTask4HardwareRenderer(rendererEvidence(renderer, vendor)).hardwareAccelerated, true);
  }
});

test('Task 4A renderer preflight fails closed for unavailable and recognizable software renderers', () => {
  for (const renderer of [
    'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))',
    'Mesa llvmpipe (LLVM 17.0.0)',
    'Microsoft Basic Render Driver',
    'ANGLE (Microsoft, WARP Direct3D11)',
    'Mesa OffScreen',
  ]) {
    const evidence = rendererEvidence(renderer);
    assert.equal(classifyTask4Renderer(evidence).classification, 'software');
    assert.throws(() => assertTask4HardwareRenderer(evidence), (error) => error.code === 'SOFTWARE_RENDERER');
  }
  const unavailable = rendererEvidence(null, null);
  unavailable.webgl.available = false;
  assert.equal(classifyTask4Renderer(unavailable).classification, 'unavailable');
  assert.throws(() => assertTask4HardwareRenderer(unavailable),
    (error) => error.code === 'RENDERER_UNAVAILABLE');
});

test('Task 4A hardware preflight is ledgered and fails before Startveil readiness or reveal', async () => {
  const source = await readFile(new URL('./owner-production-preview-harness.mjs', import.meta.url), 'utf8');
  const preflight = source.indexOf("ledger.record('renderer-preflight'");
  const assertion = source.indexOf('assertTask4HardwareRenderer(rendererEvidence)', preflight);
  const entryReadiness = source.indexOf("ledger.record('entry-readiness-start'", assertion);
  const reveal = source.indexOf("ledger.record('startveil-reveal-start'", assertion);
  assert.ok(preflight > 0 && assertion > preflight && entryReadiness > assertion && reveal > entryReadiness);
  assert.match(source.slice(preflight, assertion), /browserArguments:[\s\S]*classification:[\s\S]*hardwareAccelerated:/u);
});

test('Task 4A phase deadlines are absolute and cannot reset after expiry', async () => {
  const deadline = createPhaseDeadline(5);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 10));
  assert.throws(() => deadline.remainingMs(), (error) => error.code === 'ETIMEDOUT');
  assert.throws(() => deadline.remainingMs(), (error) => error.code === 'ETIMEDOUT');
});

test('Task 4A complete post-setup gate body has a cancelling watchdog and cleanup', async () => {
  const ledger = createOwnerPreviewLedger({ label: 'watchdog-regression' });
  const operations = createGateOperationTracker(ledger, () => {});
  let contextClosed = false;
  let cleaned = false;
  operations.start({ phase: 'settings-structure-before', control: 'settings', theme: 'none' });
  operations.complete({ phase: 'settings-structure-after', control: 'settings', theme: 'none' });
  operations.start({ phase: 'theme-select-before', control: 'workspace', theme: 'carbon' });
  await assert.rejects(runPostSetupGateWithCleanup(() => new Promise(() => {}), {
    cleanup: async () => { cleaned = true; return { remainingPids: [] }; },
    context: { close: async () => { contextClosed = true; } },
    ledger,
    operations,
    timeoutMs: 15,
  }), (error) => {
    assert.equal(error.code, 'ETIMEDOUT');
    assert.match(error.message, /last started operation: theme-select-before\/workspace\/carbon/);
    assert.match(error.message, /last completed operation: settings-structure-after\/settings\/none/);
    assert.match(error.message, /Task 4A actionable ledger/);
    return true;
  });
  assert.equal(contextClosed, true, 'Watchdog must close the context to cancel Playwright/CDP promises');
  assert.equal(cleaned, true, 'Watchdog failure must always execute the cleanup contract');
  assert.equal(ledger.entries.some(({ type }) => type === 'gate-watchdog-expired'), true);
});

test('Task 4A watchdog encloses navigation through final fixture validation', async () => {
  const source = await readFile(new URL('./owner-production-preview-harness.mjs', import.meta.url), 'utf8');
  const wrapperStart = source.indexOf('const gateOutcome = await runPostSetupGateWithCleanup(async () => {');
  const wrapperEnd = source.indexOf('cleanup: cleanupWithProgress,', wrapperStart);
  assert.ok(wrapperStart > 0 && wrapperEnd > wrapperStart, 'Post-setup gate watchdog wrapper is missing');
  for (const marker of [
    'page.goto(`${previewUrl}${fixturePath}`',
    'result = await executeGate(',
    'const finalFixture = await page.evaluate(',
    "assert.deepEqual(finalFixture.forbiddenRequests, []",
  ]) {
    const position = source.indexOf(marker, wrapperStart);
    assert.ok(position > wrapperStart && position < wrapperEnd,
      `${marker} must remain inside the complete post-setup watchdog`);
  }
});

test('Task 4A fixture configures connector context before preview client startup', () => {
  const fixture = createOwnerProductionPreviewFixtureHtml({
    previewUrl: OWNER_PRODUCTION_PREVIEW_URL,
    profileAddress: OWNER_PRODUCTION_PREVIEW_PROFILE,
  });
  const contextConfiguration = fixture.indexOf('await connector.setContextAccounts([profileAddress])');
  const contextEvidence = fixture.indexOf('fixture.connectorContextAccounts = [...connector.contextAccounts]');
  const iframeCreation = fixture.indexOf("document.createElement('iframe')");
  assert.ok(contextConfiguration > 0, 'Fixture must call the public connector context API');
  assert.ok(contextConfiguration < contextEvidence && contextEvidence < iframeCreation,
    'Connector context must be awaited and evidenced before iframe/client creation');
  assert.equal(fixture.includes('provider.contextAccounts'), false,
    'Fixture must not rely on an unrelated provider.contextAccounts property');
  assert.equal(fixture.includes('<iframe'), false,
    'Fixture must not contain a parser-created iframe that can race connector configuration');
  assert.ok(fixture.indexOf("connector.on('channelCreated', (_id, channel)") < fixture.indexOf("document.createElement('iframe')"),
    'Fixture must retain the created client channel before iframe/client startup');
  assert.ok(fixture.includes('await clientChannel.setupChannel(enable, allowedAccounts, contextAccounts, chainId)'),
    'Parent authority helper must use the installed 0.3.7 setupChannel contract');
  assert.ok(fixture.includes('allowedAccounts: [profileAddress], contextAccounts: [profileAddress], chainId: 42'),
    'Initial parent connect must grant the exact Grid profile on LUKSO chain 42');
});

test('Task 4A owner authority policy stays fail-closed around the official account roles', () => {
  const contextProfile = OWNER_PRODUCTION_PREVIEW_PROFILE;
  const visitorProfile = '0x2222222222222222222222222222222222222222';
  assert.equal(ownerChannelAuthorityAllowed({
    enable: false, allowedAccounts: [], contextAccounts: [contextProfile], profileAddress: contextProfile,
  }), false, 'Disconnected visitor must not receive owner authority');
  assert.equal(ownerChannelAuthorityAllowed({
    enable: true, allowedAccounts: [contextProfile], contextAccounts: [contextProfile], profileAddress: contextProfile,
  }), true, 'Connected visitor matching the Grid context must receive owner authority');
  assert.equal(ownerChannelAuthorityAllowed({
    enable: true, allowedAccounts: [visitorProfile], contextAccounts: [contextProfile], profileAddress: contextProfile,
  }), false, 'Different visitor and Grid context profiles must fail closed');
});

test('Task 4A only classifies synthetic profile metadata reads as fixture-induced', () => {
  const profileAddress = OWNER_PRODUCTION_PREVIEW_PROFILE;
  const otherAddress = '0x2222222222222222222222222222222222222222';
  const classify = (payload) => classifySyntheticProfileMetadataRpc({
    url: 'https://rpc.mainnet.lukso.network/', postData: JSON.stringify(payload), profileAddress,
  });
  assert.deepEqual(classify({ method: 'eth_getCode', params: [profileAddress, 'latest'] }),
    { methods: ['eth_getCode'], fixtureInduced: true });
  assert.deepEqual(classify([{ method: 'eth_getCode', params: [profileAddress, 'latest'] },
    { method: 'eth_call', params: [{ to: profileAddress, data: 'not-logged' }, 'latest'] }]),
  { methods: ['eth_getCode', 'eth_call'], fixtureInduced: true });
  assert.equal(classify({ method: 'eth_call', params: [{ to: otherAddress }, 'latest'] }).fixtureInduced, false);
  assert.equal(classify({ method: 'eth_sendTransaction', params: [{ from: profileAddress }] }).fixtureInduced, false);
});
