import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectCss, checkInventory, createInventory } from './designSystemInventory.js';

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
        token.name === '--ds-shell-radius' && token.references.includes('--ds-control-radius'),
    ),
  );
  assert.ok(
    inventory.sources.some(
      (source) =>
        source.path === 'design-system/libraryPreview.css' && source.role === 'Reference local',
    ),
  );
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
