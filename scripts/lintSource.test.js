import test from 'node:test';
import assert from 'node:assert/strict';
import { ESLint } from 'eslint';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { checkLintDebt } from './lintSource.mjs';

const root = resolve(import.meta.dirname, '..');
const eslint = new ESLint({ cwd: root });
const filePath = resolve(root, 'src/lint-proof.jsx');
const lint = text => eslint.lintText(text, { filePath });
const empty = { version: 1, entries: [] };

for (const [rule, source] of [
  ['no-undef', 'export const value = missingName;'],
  ['no-unreachable', 'export function value() { return 1; return 2; }'],
  ['no-unused-vars', 'import { useState } from "react"; export const value = 1;'],
  ['react-hooks/rules-of-hooks', 'import { useState } from "react"; export function Probe({ enabled }) { if (enabled) useState(0); return null; }'],
  ['react-hooks/exhaustive-deps', 'import { useEffect } from "react"; export function Probe({ value }) { useEffect(() => console.log(value), []); return null; }'],
]) test(`normal lint configuration rejects an introduced ${rule} violation`, async () => {
  const results = await lint(source);
  assert.ok(results[0].messages.some(message => message.ruleId === rule));
  assert.ok(checkLintDebt(results, empty, root).failures.length);
});

test('JSX references and explicit build constants are recognized without blanket undefined-name exclusions', async () => {
  const results = await lint('import { Fragment } from "react"; export function Probe() { return <Fragment>{__INSCAPE_RELEASE_COMMIT__}{__DEVELOPMENT_DIAGNOSTICS__}</Fragment>; }');
  assert.deepEqual(results[0].messages, []);
});

test('hook exceptions reject changed bytes, extra errors, stale entries and an expanded ceiling', async () => {
  const source = 'import { useEffect } from "react"; export function Probe({ value }) { useEffect(() => console.log(value), []); return null; }';
  const results = await lint(source);
  const message = results[0].messages[0];
  const entry = { file: 'src/lint-proof.jsx', ...message, sourceSha256: createHash('sha256').update(source).digest('hex'), planStep: '19', reason: 'Test fixture only' };
  const debt = { version: 1, entries: [entry] };
  assert.equal(checkLintDebt(results, debt, root).accepted, 1);
  assert.equal(checkLintDebt(results, debt, root).failures.length, 0);
  assert.match(checkLintDebt(await lint(source + '\n'), debt, root).failures.join('\n'), /changed since/);
  assert.match(checkLintDebt(await lint(source + '\nmissingName();'), debt, root).failures.join('\n'), /no-undef/);
  assert.match(checkLintDebt(await lint('export const value = 1;'), debt, root).failures.join('\n'), /stale lint exception/);
  assert.throws(() => checkLintDebt([], { version: 1, entries: Array(156).fill(entry) }, root), /ceiling/);
  assert.throws(() => checkLintDebt(results, { version: 1, entries: [entry, entry] }, root), /duplicate/);
  for (const planStep of ['00', '31', '99'])
    assert.throws(() => checkLintDebt(results, { version: 1, entries: [{ ...entry, planStep }] }, root), /Invalid/);
});

test('the reported lint scope excludes tests and applies the correctness rules to production JSX', async () => {
  assert.equal(await eslint.isPathIgnored(resolve(root, 'src/systemWorkflow/workbenchCollection.test.js')), true);
  assert.equal(await eslint.isPathIgnored(resolve(root, 'src/public/ownerSystemWorkflow/DisplayModule.jsx')), false);
  const config = await eslint.calculateConfigForFile(filePath);
  for (const rule of ['no-undef', 'no-unreachable', 'no-unused-vars', 'react-hooks/rules-of-hooks', 'react-hooks/exhaustive-deps'])
    assert.equal(config.rules[rule][0], 2, rule);
});
