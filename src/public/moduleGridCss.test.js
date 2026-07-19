import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('expanded windows allow descendant touch scrolling while interaction surfaces capture touch', () => {
  const css = readFileSync(new URL('./moduleGrid.css', import.meta.url), 'utf8');
  const expandedRule = css.match(/\.module-shell--expanded\s*\{([^}]*)\}/)?.[1] || '';
  const resizeRule = css.match(/\.module-window__resize\s*\{([^}]*)\}/)?.[1] || '';
  const dragRules = [...css.matchAll(/\.identity-dossier__drag-handle\s*\{([^}]*)\}/g)].map((match) => match[1]);
  assert.doesNotMatch(expandedRule, /touch-action\s*:\s*none/);
  assert.match(resizeRule, /touch-action\s*:\s*none/);
  assert.equal(dragRules.some((rule) => /touch-action\s*:\s*none/.test(rule)), true);
});
