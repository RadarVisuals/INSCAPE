import { ESLint } from 'eslint';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const fingerprint = text => createHash('sha256').update(text).digest('hex');
const key = item => JSON.stringify([item.file, item.ruleId, item.line, item.column, item.message]);
// This ceiling is the reviewed initial debt, not an automatically refreshed baseline.
// A new diagnostic must be fixed; there is deliberately no --update/--suppress mode.
const initialDebtLimit = 155;

export function checkLintDebt(results, debt, root) {
  if (debt.version !== 1 || !Array.isArray(debt.entries) || debt.entries.length > initialDebtLimit)
    throw Error('Invalid lint debt ledger or expanded initial debt ceiling');
  const allowances = new Map();
  for (const entry of debt.entries) {
    if (entry.ruleId !== 'react-hooks/exhaustive-deps' || !/^(?:0[1-9]|[12]\d|30)$/u.test(entry.planStep)
      || !entry.reason?.trim() || !/^[a-f0-9]{64}$/u.test(entry.sourceSha256) || allowances.has(key(entry)))
      throw Error(`Invalid or duplicate lint exception: ${entry.file}:${entry.line}`);
    allowances.set(key(entry), entry);
  }
  const failures = [];
  let accepted = 0;
  for (const result of results) {
    const file = relative(root, result.filePath).replaceAll('\\', '/');
    for (const message of result.messages) {
      const item = { file, ...message }, id = key(item), allowance = allowances.get(id);
      if (!allowance) failures.push(`${file}:${message.line}:${message.column} ${message.ruleId || 'parse'}: ${message.message}`);
      else {
        allowances.delete(id);
        if (fingerprint(result.source) !== allowance.sourceSha256)
          failures.push(`${file}:${message.line} changed since its recorded hook review; resolve or explicitly re-review the exception for step ${allowance.planStep}`);
        else accepted++;
      }
    }
  }
  for (const allowance of allowances.values())
    failures.push(`${allowance.file}:${allowance.line} stale lint exception; remove it after checking the change`);
  return { files: results.length, accepted, failures };
}

export async function lintSource(root = resolve(import.meta.dirname, '..')) {
  const eslint = new ESLint({ cwd: root });
  const results = await eslint.lintFiles(['src']);
  const debt = JSON.parse(await readFile(resolve(root, 'scripts/lint-debt.json'), 'utf8'));
  return checkLintDebt(results, debt, root);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = await lintSource();
    console.log(`Lint: ${report.files} source files; ${report.accepted} recorded hook-dependency observations remain assigned to plan steps.`);
    for (const failure of report.failures) console.error(failure);
    if (report.failures.length) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
