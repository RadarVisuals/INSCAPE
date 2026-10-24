import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'tsconfig.contracts.json');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
assert.equal(config.error, undefined);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
assert.equal(parsed.errors.length, 0);
const production = [
  'src/systemWorkflow/systemWorkflowDraftStore.js',
  'src/public/ownerSystemWorkflow/WorkbenchViewContext.js',
  'src/public/ownerSystemWorkflow/workbenchPresentationCapture.js',
];
const proof = 'typechecks/workbench-contracts.ts';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const key = file => path.resolve(file).toLowerCase();
function check(overrides = {}) {
  const host = ts.createCompilerHost(parsed.options);
  const originalRead = host.readFile.bind(host);
  const virtual = new Map(Object.entries(overrides).map(([file, text]) => [key(path.join(root, file)), text]));
  host.readFile = file => virtual.get(key(file)) ?? originalRead(file);
  const program = ts.createProgram(parsed.fileNames, parsed.options, host);
  return ts.getPreEmitDiagnostics(program).map(diagnostic => ({
    file: diagnostic.file ? path.relative(root, diagnostic.file.fileName).replaceAll('\\', '/') : null,
    line: diagnostic.file && diagnostic.start !== undefined
      ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1 : null,
    code: diagnostic.code,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
  }));
}
const positive = check();
assert.deepEqual(positive, [], JSON.stringify(positive, null, 2));
const proofText = read(proof);
const expectedLines = proofText.split(/\r?\n/).flatMap((line, index) => line.includes('@ts-expect-error') ? [index + 2] : []);
assert.equal(expectedLines.length, 17);
const negatives = check({ [proof]: proofText.replaceAll('@ts-expect-error', 'expected type failure') });
assert.equal(negatives.length, expectedLines.length, JSON.stringify(negatives, null, 2));
for (const line of expectedLines) assert.ok(negatives.some(item => item.file === proof && item.line === line), `Missing rejection at ${line}`);

const mutations = [
  [production[0], 'getSnapshot: () => current() ? api.getSnapshot() : session.snapshot,', 'getSnapshot: () => 42,'],
  [production[1], '(toolSources).set(id, current)', '(toolSources).set(id, 42)'],
  [production[2], "value: null };", "value: 42 };"],
].map(([file, from, to]) => {
  const text = read(file);
  assert.equal(text.split(from).length, 2, `Mutation must match once: ${file}`);
  const diagnostics = check({ [file]: text.replace(from, to) });
  assert.ok(diagnostics.some(item => item.file === file), `Production body escaped checking: ${file}`);
  return { file, from, to, diagnostics };
});

// Ignore comments and grouping parentheses, retaining executable syntax and values.
function shape(node) {
  if (ts.isParenthesizedExpression(node)) return shape(node.expression);
  const children = [];
  ts.forEachChild(node, child => { children.push(shape(child)); });
  const declarationFlags = ts.isVariableDeclarationList(node) ? node.flags & ts.NodeFlags.BlockScoped : 0;
  return children.length ? [node.kind, declarationFlags, children] : [node.kind, node.kind <= ts.SyntaxKind.LastToken ? node.getText() : ''];
}
const hash = text => createHash('sha256').update(text).digest('hex');
const beforeArg = process.argv.find(value => value.startsWith('--before='));
const equivalence = beforeArg ? production.map(file => {
  const before = fs.readFileSync(path.join(beforeArg.slice('--before='.length), file), 'utf8');
  const after = read(file);
  const ast = text => shape(ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS));
  assert.deepEqual(ast(after), ast(before), `Executable syntax changed: ${file}`);
  return { file, executableSyntaxEqual: true, beforeSha256: hash(before), afterSha256: hash(after) };
}) : [];
const report = { typescript: ts.version, config: config.config, positiveDiagnostics: positive,
  negativeCallDiagnostics: negatives, productionMutations: mutations, equivalence,
  inputs: [...production, 'src/contracts/workbench.d.ts', 'tsconfig.contracts.json', proof,
    'typechecks/verify-workbench-contracts.mjs'].map(file => ({ file, sha256: hash(read(file)) })) };
const outputArg = process.argv.find(value => value.startsWith('--output='));
if (outputArg) fs.writeFileSync(outputArg.slice('--output='.length), JSON.stringify(report, null, 2) + '\n');
console.log(`Contracts: strict check passed; ${negatives.length} invalid calls rejected; ${mutations.length} production mutations rejected; ${equivalence.length} executable syntax comparisons passed.`);
