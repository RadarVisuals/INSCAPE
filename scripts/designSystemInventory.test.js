import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectCss, checkInventory, createInventory } from './designSystemInventory.js';

test('inventory is identical for Windows and Linux multiline CSS', () => {
  const css = `:root {
    --shadow:
      0 1px 2px black,
      0 0 3px var(--surface);
  }
  @media (forced-colors: active) {
    .first,
    .second { --shadow: none; }
  }`;
  const linux = inspectCss(css, 'sample.css', 'Material');
  const windows = inspectCss(css.replaceAll('\n', '\r\n'), 'sample.css', 'Material');
  assert.deepEqual(windows, linux);
  assert.equal(linux.definitions[0].line, 2);
  assert.deepEqual(linux.definitions[0].references, ['--surface']);
});

test('inventory retains cascade scope, aliases, media modes and complex CSS values', () => {
  const css =
    ':root { --surface: #191b1b; --face: linear-gradient(165deg, white, var(--surface)); }\n@media (forced-colors: active) { [data-material] { --surface: Canvas; --face: var(--surface); } }';
  const result = inspectCss(css, 'sample.css', 'Material');
  assert.equal(result.definitions.length, 4);
  assert.deepEqual(result.definitions[2].scope, [
    '@media (forced-colors: active)',
    '[data-material]',
  ]);
  assert.equal(result.definitions[1].value, 'linear-gradient(165deg, white, var(--surface))');
  assert.deepEqual(result.definitions[1].references, ['--surface']);
  assert.equal(result.definitions[2].line, 2);
  assert.equal(inspectCss(css.replaceAll('\n', '\r\n'), 'sample.css').sha256, result.sha256);
});

test('checked-in inventory and registered implementation/evidence paths match the current system', async () => {
  const counts = await checkInventory();
  assert.ok(counts.files > 0 && counts.definitions > counts.names);
});

test('reference values and production defaults remain separately scoped and discoverable', async () => {
  const inventory = await createInventory();
  const reference = inventory.sources.find(
    (source) => source.path === 'design-system/referenceTokens.css',
  );
  assert.equal(reference.role, 'Reference');
  assert.ok(
    reference.definitions.some(
      (token) =>
        token.name === '--ds-shell-radius' && token.references.includes('--control-shell-radius'),
    ),
  );
  assert.ok(
    inventory.sources.some(
      (source) =>
        source.path === 'design-system/libraryPreview.css' && source.role === 'Reference local',
    ),
  );
  const foundation = inventory.sources.find(source => source.path === 'src/inscapeTokens.css');
  assert.ok(foundation.definitions.some(token => token.name === '--control-shell-radius' && token.references.includes('--control-radius')));
  const flat = inventory.sources.find(source => source.path.endsWith('/workflowFlat.css'));
  assert.equal(flat.role, 'Flat material');
  assert.ok(flat.definitions.every(token => token.scope.some(scope => scope.includes('[data-workflow-finish='))));
  const focus = inventory.sources.flatMap((source) =>
    source.definitions
      .filter((token) => token.name === '--color-focus')
      .map((token) => ({ ...token, source: source.path })),
  );
  assert.ok(focus.some((token) => token.source === 'src/inscapeTokens.css'));
  assert.ok(
    focus.some(
      (token) =>
        token.source === 'design-system/reference.css' &&
        token.scope.some((scope) => scope.includes('.ds-reference')),
    ),
  );
});
