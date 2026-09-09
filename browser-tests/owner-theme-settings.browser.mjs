import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  OWNER_PREVIEW_LIFECYCLE_TIMEOUTS,
  OWNER_PREVIEW_TIMEOUT_MS,
  OWNER_PRODUCTION_PREVIEW_URL,
  atomicSettingsSnapshot,
  createPhaseDeadline,
  recordSettingsStep,
  runOwnerProductionPreviewGate,
} from './owner-production-preview-harness.mjs';
import { BROWSER_LIFECYCLE_TIMEOUTS, withinDeadline } from './browser-test-lifecycle.mjs';

const themes = Object.freeze(['carbon', 'graphite', 'slate', 'ash', 'mist', 'paper']);

function assertStable(actual, baseline, message) {
  assert.equal(actual.url, baseline.url, `${message}: URL changed`);
  assert.equal(actual.documentId, baseline.documentId, `${message}: document changed`);
  assert.equal(actual.ownerId, baseline.ownerId, `${message}: owner root remounted`);
  assert.equal(actual.settingsId, baseline.settingsId, `${message}: Settings remounted`);
  assert.equal(actual.workspaceControlId, baseline.workspaceControlId, `${message}: workspace control was replaced`);
  assert.equal(actual.menuControlId, baseline.menuControlId, `${message}: menu control was replaced`);
  assert.equal(actual.workspaceControlAttached, true, `${message}: workspace control detached`);
  assert.equal(actual.menuControlAttached, true, `${message}: menu control detached`);
}

async function waitForExactFocus(frame, locator, message, deadline) {
  const handle = await locator.elementHandle({ timeout: deadline.remainingMs() });
  assert.ok(handle, `${message}: focus target was not attached`);
  await frame.waitForFunction((node) => document.activeElement === node, handle,
    { timeout: deadline.remainingMs() });
}

async function runThemeSettingsGate({ frame, ledger, operations, previewUrl }) {
  const toolbar = frame.getByRole('navigation', { name: 'Owner workspace tools' });
  const themeButton = toolbar.getByRole('button', { name: 'THEME', exact: true });
  const owner = frame.getByRole('main').filter({ has: toolbar });
  const modulator = frame.getByRole('region', { name: 'Modulator' });
  await Promise.all([
    owner.waitFor({ state: 'visible', timeout: OWNER_PREVIEW_TIMEOUT_MS }),
    modulator.waitFor({ state: 'visible', timeout: OWNER_PREVIEW_TIMEOUT_MS }),
    themeButton.waitFor({ state: 'visible', timeout: OWNER_PREVIEW_TIMEOUT_MS }),
  ]);
  const initial = await withinDeadline(frame.evaluate(() => {
    const ownerRoot = document.querySelector('main.owner-lattice-shell');
    const modulatorRoot = document.querySelector('[aria-label="Modulator"]');
    return {
      url: location.href,
      documentId: window.__task4OwnerHarness.documentId,
      ownerId: window.__task4OwnerHarness.nodeId(ownerRoot),
      modulatorId: window.__task4OwnerHarness.nodeId(modulatorRoot),
    };
  }), OWNER_PREVIEW_TIMEOUT_MS, 'Initial Theme gate identity snapshot deadline exceeded');
  assert.equal(initial.url, `${previewUrl}/`);
  ledger.record('theme-gate-ready', initial);

  const settingsDeadline = createPhaseDeadline(OWNER_PREVIEW_LIFECYCLE_TIMEOUTS.themeSettingsMs);
  ledger.record('theme-settings-start', { deadlineMs: OWNER_PREVIEW_LIFECYCLE_TIMEOUTS.themeSettingsMs });
  operations.start({ phase: 'settings-open-before', control: 'settings', theme: 'none' });
  await recordSettingsStep({ deadline: settingsDeadline, ledger, step: 'theme-click' }, () =>
    themeButton.click({ timeout: settingsDeadline.remainingMs() }));
  const settingsDialogs = frame.getByRole('dialog', { name: 'SETTINGS' });
  await recordSettingsStep({ deadline: settingsDeadline, ledger, step: 'dialog-wait-for' }, () =>
    settingsDialogs.first().waitFor({ state: 'visible', timeout: settingsDeadline.remainingMs() }));
  const dialogCount = await recordSettingsStep({ deadline: settingsDeadline, ledger, step: 'settings-dialog-count' }, () =>
    withinDeadline(settingsDialogs.count(), settingsDeadline.remainingMs(),
      'SETTINGS accessible-role count exceeded the remaining Settings phase deadline'));
  assert.equal(dialogCount, 1, 'Expected exactly one SETTINGS dialog');
  operations.complete({ phase: 'settings-open-after', control: 'settings', theme: 'none' });
  const settings = settingsDialogs.first();
  const workspaceControl = settings.getByRole('combobox', { name: 'WORKSPACE / SURFACE', exact: true });
  const menuControl = settings.getByRole('combobox', { name: 'MENU / INTERFACE', exact: true });
  operations.start({ phase: 'settings-structure-before', control: 'settings', theme: 'none' });
  const baseline = await recordSettingsStep({ deadline: settingsDeadline, ledger, step: 'atomic-settings-snapshot' }, () =>
    atomicSettingsSnapshot(settings, settingsDeadline));
  ledger.record('settings-structure', { dialogCount, ...baseline });
  assert.equal(baseline.comboboxCount, 2, 'SETTINGS dialog must expose exactly two comboboxes');
  assert.equal(baseline.selects[0]?.label, 'WORKSPACE / SURFACE',
    'First SETTINGS combobox is not labelled WORKSPACE / SURFACE');
  assert.equal(baseline.selects[1]?.label, 'MENU / INTERFACE',
    'Second SETTINGS combobox is not labelled MENU / INTERFACE');
  assert.equal(baseline.dialogComputedVisible, true, 'SETTINGS dialog is not computed visible');
  assert.equal(baseline.selects[0]?.computedVisible, true, 'Workspace Theme combobox is not computed visible');
  assert.equal(baseline.selects[1]?.computedVisible, true, 'Menu Theme combobox is not computed visible');
  assert.deepEqual(baseline.selects[0]?.options, themes.map((theme) => theme.toUpperCase()),
    'Workspace Theme combobox does not expose the six canonical option labels');
  assert.deepEqual(baseline.selects[0]?.values, [...themes],
    'Workspace Theme combobox does not expose the six canonical option values');
  assert.deepEqual(baseline.selects[1]?.options, themes.map((theme) => theme.toUpperCase()),
    'Menu Theme combobox does not expose the six canonical option labels');
  assert.deepEqual(baseline.selects[1]?.values, [...themes],
    'Menu Theme combobox does not expose the six canonical option values');
  assert.equal(baseline.documentId, initial.documentId);
  assert.equal(baseline.ownerId, initial.ownerId);
  operations.complete({ phase: 'settings-structure-after', control: 'settings', theme: 'none' });
  let ariaSnapshot = null;
  let ariaSnapshotError = null;
  try {
    ariaSnapshot = await recordSettingsStep({
      deadline: settingsDeadline, ledger, step: 'optional-aria-snapshot',
    }, () => typeof settings.ariaSnapshot === 'function' ? settings.ariaSnapshot({
        timeout: Math.min(BROWSER_LIFECYCLE_TIMEOUTS.commandMs, settingsDeadline.remainingMs()),
      }) : null);
  } catch (error) {
    ariaSnapshotError = { name: error.name, message: error.message };
  }
  ledger.record('settings-aria-diagnostic', { ariaSnapshot, ariaSnapshotError });
  const lifecycleBaseline = ledger.entries.length;
  ledger.record('settings-ready', baseline);

  for (const theme of themes) {
    operations.start({ phase: 'theme-select-before', control: 'workspace', theme });
    await workspaceControl.selectOption(theme, { timeout: settingsDeadline.remainingMs() });
    await frame.waitForFunction((expected) =>
      document.querySelector('main.owner-lattice-shell')?.getAttribute('data-surface') === expected,
    theme, { timeout: settingsDeadline.remainingMs() });
    const workspaceState = await atomicSettingsSnapshot(settings, settingsDeadline);
    assertStable(workspaceState, baseline, `workspace theme ${theme}`);
    assert.equal(workspaceState.surface, theme, `workspace theme ${theme} did not activate`);
    ledger.record('theme-selected', { control: 'workspace', theme, ...workspaceState });
    operations.complete({ phase: 'theme-select-after', control: 'workspace', theme });

    operations.start({ phase: 'theme-select-before', control: 'menu', theme });
    await menuControl.selectOption(theme, { timeout: settingsDeadline.remainingMs() });
    await frame.waitForFunction((expected) =>
      document.querySelector('main.owner-lattice-shell')?.getAttribute('data-menu-surface') === expected,
    theme, { timeout: settingsDeadline.remainingMs() });
    const menuState = await atomicSettingsSnapshot(settings, settingsDeadline);
    assertStable(menuState, baseline, `menu theme ${theme}`);
    assert.equal(menuState.menuSurface, theme, `menu theme ${theme} did not activate`);
    ledger.record('theme-selected', { control: 'menu', theme, ...menuState });
    operations.complete({ phase: 'theme-select-after', control: 'menu', theme });
  }

  const unexpectedLifecycle = ledger.entries.slice(lifecycleBaseline).filter(({ type, frameUrl }) =>
    ['framenavigated', 'pagehide', 'page-close', 'page-crash'].includes(type)
      && (!frameUrl || frameUrl === `${previewUrl}/`));
  assert.deepEqual(unexpectedLifecycle, [], 'Theme selection caused navigation, pagehide, close, or crash');

  operations.start({ phase: 'escape-before', control: 'settings', theme: 'none' });
  await menuControl.press('Escape', { timeout: settingsDeadline.remainingMs() });
  await settings.waitFor({ state: 'detached', timeout: settingsDeadline.remainingMs() });
  await waitForExactFocus(frame, themeButton,
    'Escape did not restore exact focus to the Theme toolbar control', settingsDeadline);
  ledger.record('settings-closed', { method: 'escape', focus: 'THEME' });
  const afterEscape = await withinDeadline(frame.evaluate(() => {
    const owner = document.querySelector('main.owner-lattice-shell');
    const modulator = document.querySelector('[aria-label="Modulator"]');
    return {
      documentId: window.__task4OwnerHarness.documentId,
      ownerId: window.__task4OwnerHarness.nodeId(owner),
      modulatorId: window.__task4OwnerHarness.nodeId(modulator),
      url: location.href,
    };
  }), settingsDeadline.remainingMs(), 'Escape identity snapshot exceeded the remaining Settings phase deadline');
  assert.deepEqual(afterEscape, initial, 'Escape changed owner, MODUL-8R, document, or URL identity');
  operations.complete({ phase: 'escape-after', control: 'settings', theme: 'none' });

  operations.start({ phase: 'settings-open-before', control: 'settings', theme: 'none' });
  await themeButton.click({ timeout: settingsDeadline.remainingMs() });
  const reopenedSettings = frame.getByRole('dialog', { name: 'SETTINGS' });
  await reopenedSettings.waitFor({ state: 'visible', timeout: settingsDeadline.remainingMs() });
  operations.complete({ phase: 'settings-open-after', control: 'settings', theme: 'none' });
  operations.start({ phase: 'explicit-close-before', control: 'settings', theme: 'none' });
  await reopenedSettings.getByRole('button', { name: 'Close Modulator settings', exact: true })
    .click({ timeout: settingsDeadline.remainingMs() });
  await reopenedSettings.waitFor({ state: 'detached', timeout: settingsDeadline.remainingMs() });
  await waitForExactFocus(frame, themeButton,
    'Explicit close did not restore exact focus to the Theme toolbar control', settingsDeadline);
  ledger.record('settings-closed', { method: 'explicit', focus: 'THEME' });

  const finalIdentity = await withinDeadline(frame.evaluate(() => {
    const owner = document.querySelector('main.owner-lattice-shell');
    const modulator = document.querySelector('[aria-label="Modulator"]');
    return {
      documentId: window.__task4OwnerHarness.documentId,
      ownerId: window.__task4OwnerHarness.nodeId(owner),
      modulatorId: window.__task4OwnerHarness.nodeId(modulator),
      url: location.href,
    };
  }), settingsDeadline.remainingMs(), 'Explicit-close identity snapshot exceeded the remaining Settings phase deadline');
  assert.deepEqual(finalIdentity, initial, 'Explicit close changed owner, MODUL-8R, document, or URL identity');
  operations.complete({ phase: 'explicit-close-after', control: 'settings', theme: 'none' });
  ledger.record('theme-settings-complete', { elapsedMs: settingsDeadline.elapsedMs() });
  return { documentId: initial.documentId, ownerId: initial.ownerId, themes: [...themes] };
}

test('Task 4A production preview Theme/Settings release gate', async () => {
  const runLabel = process.env.TASK4A_RUN_LABEL || 'independent';
  const evidence = await runOwnerProductionPreviewGate(runThemeSettingsGate, { label: runLabel });
  console.log(`Task 4A evidence ${JSON.stringify({
    runLabel,
    preview: OWNER_PRODUCTION_PREVIEW_URL,
    documentId: evidence.result.documentId,
    ownerId: evidence.result.ownerId,
    themes: evidence.result.themes,
    runtimeName: evidence.runtimeName,
    cleanup: evidence.cleanup,
    ledgerEntries: evidence.ledger.length,
    startveil: evidence.ledger.filter(({ type }) => type === 'startveil-state')
      .map(({ elapsedMs, state, documentId }) => ({ elapsedMs, state, documentId })),
    maxLongTaskMs: Math.max(0, ...evidence.ledger.filter(({ type }) => type === 'long-task')
      .map(({ duration }) => duration)),
  })}`);
});
