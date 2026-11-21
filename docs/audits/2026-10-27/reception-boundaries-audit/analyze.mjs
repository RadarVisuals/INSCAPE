import { readFile, stat, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import postcss from 'postcss';
const out = dirname(fileURLToPath(import.meta.url));
const root = resolve(out, '../../../..');
const manifest = JSON.parse(await readFile(resolve(root, 'dist/.vite/manifest.json'), 'utf8'));
const closure = key => {
  const visited = new Set();
  const visit = key => { if (visited.has(key)) return; visited.add(key); for (const child of manifest[key]?.imports || []) visit(child); };
  visit(key); return [...visited];
};
const names = new Set(['ProfileOverview', 'OwnerReception', 'ReceptionStoreEditor', 'ReceptionTextEditor', 'OwnerSystemWorkflowShell', 'ProfileDocumentV9Preview', 'OwnerWorkbenchOverview', 'OwnerSystemWorkflowRuntime']);
const entries = Object.keys(manifest).filter(key => names.has(manifest[key].name));
const entryClosure = new Set(closure('index.html').map(k => manifest[k]?.file));
const routes = [];
for (const entry of entries) {
  const keys = closure(entry), files = [...new Set(keys.map(k => manifest[k]?.file).filter(Boolean))];
  const css = [...new Set(keys.flatMap(k => manifest[k]?.css || []))];
  const summarize = async files => {
    const result = [];
    for (const file of files) { const data = await readFile(resolve(root, 'dist', file)); result.push({ file, raw: data.length, gzip: gzipSync(data).length }); }
    return { raw: result.reduce((n, v) => n + v.raw, 0), gzip: result.reduce((n, v) => n + v.gzip, 0), files: result };
  };
  routes.push({ entry, keys, javaScript: await summarize(files), additionalToEntry: await summarize(files.filter(f => !entryClosure.has(f))), css: await summarize(css), dynamicImports: manifest[entry].dynamicImports });
}
const cssPaths = ['src/reception/reception.css', 'src/public/ownerSystemWorkflow/workflowTactile.css', 'src/public/ownerSystemWorkflow/workflowFlat.css', 'src/public/ownerSystemWorkflow/workbenchToolChrome.css', 'src/public/ownerSystemWorkflow/workbenchToolPanel.css', 'src/public/ownerSystemWorkflow/ownerSystemWorkflow.css'];
const styles = [];
for (const path of cssPaths) {
  const source = await readFile(resolve(root, path), 'utf8'); const ast = postcss.parse(source); const rules = []; const repeated = new Map(); let important = 0;
  ast.walkRules(rule => { let parent = rule.parent; const condition = []; while (parent && parent.type !== 'root') { condition.push(parent.name + ' ' + parent.params); parent = parent.parent; }
    const key = condition.reverse().join(' / ') + '|' + rule.selector; const values = repeated.get(key) || []; values.push(rule.source.start.line); repeated.set(key, values); rules.push(rule.selector);
  });
  ast.walkDecls(d => { if (d.important) important++; });
  styles.push({ path, bytes: (await stat(resolve(root, path))).size, rules: rules.length, important, repeatedSelectorsInSameCondition: [...repeated].filter(([, lines]) => lines.length > 1).map(([selector, lines]) => ({ selector, lines })) });
}
await writeFile(resolve(out, 'bundle-and-css.json'), JSON.stringify({ routes, styles }, null, 2));
console.log(JSON.stringify({ routes: routes.map(r => ({ entry: r.entry, staticJS: r.javaScript.raw, additionalToEntry: r.additionalToEntry.raw, css: r.css.raw, dynamicImports: r.dynamicImports })), styles }, null, 2));
