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
  atomicSettingsSnapshot,
  assertTask4HardwareRenderer,
  classifyTask4Renderer,
  classifySyntheticProfileMetadataRpc,
  createGateOperationTracker,
  createOwnerProductionPreviewFixtureHtml,
  createOwnerPreviewLedger,
  createPhaseDeadline,
  ownerChannelAuthorityAllowed,
  recordSettingsStep,
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

test('Task 4A Settings step telemetry records monotone before/after time and budget', async () => {
  const monotonicTimes = [1_000, 1_001, 1_004];
  const ledger = createOwnerPreviewLedger({
    label: 'settings-telemetry', monotonicNow: () => monotonicTimes.shift(),
  });
  const remainingBudgets = [30_000, 29_975];
  const deadline = { remainingBudgetMs: () => remainingBudgets.shift() };
  assert.equal(await recordSettingsStep({ deadline, ledger, step: 'theme-click' }, async () => 'clicked'), 'clicked');
  assert.deepEqual(ledger.entries.map(({ type, step, outcome, monotonicElapsedMs, remainingSettingsMs }) => ({
    type, step, outcome, monotonicElapsedMs, remainingSettingsMs,
  })), [
    { type: 'settings-step-before', step: 'theme-click', outcome: undefined,
      monotonicElapsedMs: 1, remainingSettingsMs: 30_000 },
    { type: 'settings-step-after', step: 'theme-click', outcome: 'complete',
      monotonicElapsedMs: 4, remainingSettingsMs: 29_975 },
  ]);
});

test('Task 4A Settings step telemetry records definitive deadline failure', async () => {
  let monotonic = 5_000;
  const ledger = createOwnerPreviewLedger({ monotonicNow: () => monotonic++ });
  const deadline = createPhaseDeadline(10, () => monotonic);
  monotonic += 11;
  await assert.rejects(recordSettingsStep({ deadline, ledger, step: 'atomic-settings-snapshot' }, async () => {
    deadline.remainingMs();
  }), (error) => error.code === 'ETIMEDOUT');
  assert.deepEqual(ledger.entries.map(({ type, outcome, code, remainingSettingsMs }) => ({
    type, outcome, code, remainingSettingsMs,
  })), [
    { type: 'settings-step-before', outcome: undefined, code: undefined, remainingSettingsMs: 0 },
    { type: 'settings-step-after', outcome: 'failed', code: 'ETIMEDOUT', remainingSettingsMs: 0 },
  ]);
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
  const wrapperEnd = source.indexOf('\n    }, {\n      cleanup: cleanupWithProgress,', wrapperStart);
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

test('Task 4A Theme state check is one atomic concrete-dialog locator evaluation', async () => {
  let evaluations = 0;
  const expected = { documentId: 'document', ownerId: 'owner', settingsId: 'settings' };
  const settings = { evaluate: async () => { evaluations += 1; return expected; } };
  const deadline = { remainingMs: () => 100 };
  assert.strictEqual(await atomicSettingsSnapshot(settings, deadline), expected);
  assert.equal(evaluations, 1);
  const source = await readFile(new URL('./owner-production-preview-harness.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('export async function atomicSettingsSnapshot');
  const end = source.indexOf('\n}\n\nfunction safeDetails', start);
  const implementation = source.slice(start, end);
  assert.equal(implementation.split('settings.evaluate(').length - 1, 1);
  assert.equal(implementation.includes('aria-label="SETTINGS"'), false,
    'Atomic state lookup must not duplicate Playwright accessible-name resolution');
  for (const field of ['ownerId', 'settingsId', 'workspaceControlId', 'menuControlId',
    'ownerAttached', 'settingsAttached', 'workspaceControlAttached', 'menuControlAttached',
    'surface', 'menuSurface']) assert.match(implementation, new RegExp(`\\b${field}\\b`, 'u'));
});

test('Task 4A resolves the real aria-labelledby production Settings dialog exactly once before snapshot', async () => {
  const gateSource = await readFile(new URL('./owner-theme-settings.browser.mjs', import.meta.url), 'utf8');
  const productionSource = await readFile(new URL('../src/lattice/modul8r/Modul8rSettingsSurface.jsx', import.meta.url), 'utf8');
  assert.match(productionSource,
    /<section aria-labelledby="modul8r-settings-title"[^>]*role="dialog">/u,
  'Production Settings must retain its role=dialog plus aria-labelledby contract');
  assert.match(productionSource, /<strong id="modul8r-settings-title">SETTINGS<\/strong>/u);
  assert.doesNotMatch(productionSource, /<section[^>]*aria-label=/u,
    'Regression contract must not invent an aria-label on production Settings');
  const roleLookup = gateSource.indexOf("frame.getByRole('dialog', { name: 'SETTINGS' })");
  const exactCount = gateSource.indexOf('assert.equal(dialogCount, 1', roleLookup);
  const atomicSnapshot = gateSource.indexOf('atomicSettingsSnapshot(settings, settingsDeadline)', roleLookup);
  assert.ok(roleLookup > 0 && exactCount > roleLookup && atomicSnapshot > exactCount,
    'Playwright must resolve and prove the unique accessible dialog before its concrete locator is evaluated');
  const ariaSnapshot = gateSource.indexOf('settings.ariaSnapshot(', atomicSnapshot);
  assert.ok(ariaSnapshot > atomicSnapshot,
    'Best-effort ARIA diagnostics must run only after the authoritative atomic Settings snapshot');
  assert.ok(gateSource.indexOf("ledger.record('settings-structure'", atomicSnapshot) < ariaSnapshot,
    'Authoritative Settings evidence must be recorded before optional ARIA diagnostics');
});

test('Task 4A interactive Theme operations all consume the remaining absolute phase deadline', async () => {
  const source = await readFile(new URL('./owner-theme-settings.browser.mjs', import.meta.url), 'utf8');
  assert.equal(source.includes('stateSnapshot'), false, 'Sequential stateSnapshot round-trips must not return');
  const callsFor = (method) => {
    const calls = []; const marker = `.${method}(`; let cursor = 0;
    while ((cursor = source.indexOf(marker, cursor)) >= 0) {
      const start = cursor; let index = cursor + marker.length; let depth = 1; let quote = null; let escaped = false;
      for (; index < source.length && depth > 0; index += 1) {
        const character = source[index];
        if (quote) {
          if (escaped) escaped = false;
          else if (character === '\\') escaped = true;
          else if (character === quote) quote = null;
        } else if (character === '"' || character === "'" || character === '`') quote = character;
        else if (character === '(') depth += 1;
        else if (character === ')') depth -= 1;
      }
      calls.push(source.slice(start, index)); cursor = index;
    }
    return calls;
  };
  for (const method of ['click', 'selectOption', 'press', 'waitForFunction', 'ariaSnapshot']) {
    const calls = callsFor(method);
    assert.ok(calls.length > 0, `Expected at least one ${method} operation in the Theme gate`);
    for (const call of calls) {
      assert.match(call, /timeout:/u, `Every ${method} operation in the Theme gate must set an explicit timeout`);
      assert.match(call, /(?:settingsDeadline|deadline)\.remainingMs\(\)/u,
        `Every ${method} operation in the Theme gate must use the remaining Settings deadline`);
    }
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
