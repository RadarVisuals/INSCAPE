import { readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { relative, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import postcss from 'postcss';
import { tokenSources, components, system } from '../design-system/registry.js';

const root = fileURLToPath(new URL('../', import.meta.url));
export const outputPath = resolve(root, 'design-system/tokens.generated.json');
const slash = (value) => value.replaceAll('\\', '/');
const hash = (value) => createHash('sha256').update(value.replaceAll('\r\n', '\n')).digest('hex');

export function inspectCss(css, path, role = 'Local') {
  const definitions = [];
  const references = new Set();
  postcss.parse(css, { from: path }).walkDecls((declaration) => {
    for (const match of declaration.value.matchAll(/var\(\s*(--[\w-]+)/g)) references.add(match[1]);
    if (!declaration.prop.startsWith('--')) return;
    const scope = [];
    for (let node = declaration.parent; node && node.type !== 'root'; node = node.parent) {
      if (node.type === 'rule') scope.unshift(node.selector);
      if (node.type === 'atrule') scope.unshift(`@${node.name} ${node.params}`.trim());
    }
    definitions.push({
      name: declaration.prop,
      value: declaration.value,
      scope,
      line: declaration.source.start.line,
      references: [...declaration.value.matchAll(/var\(\s*(--[\w-]+)/g)].map((match) => match[1]),
    });
  });
  return { path, role, sha256: hash(css), definitions, references: [...references].sort() };
}

async function cssFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? cssFiles(resolve(directory, entry.name))
        : entry.name.endsWith('.css')
          ? [resolve(directory, entry.name)]
          : [],
    ),
  );
  return nested.flat().sort();
}

export async function createInventory() {
  const paths = (
    await Promise.all(
      ['src', 'design-system'].map((directory) => cssFiles(resolve(root, directory))),
    )
  )
    .flat()
    .sort();
  const sources = await Promise.all(
    paths.map(async (path) => {
      const source = slash(relative(root, path));
      return inspectCss(
        await readFile(path, 'utf8'),
        source,
        tokenSources.find((item) => item.path === source)?.role ??
          (source.startsWith('design-system/') ? 'Reference local' : 'Local'),
      );
    }),
  );
  for (const { path } of tokenSources) {
    if (!sources.some((source) => source.path === path))
      throw new Error(`Missing token source: ${path}`);
  }
  for (const component of components) {
    for (const path of [component.source, component.evidence]) await readFile(resolve(root, path));
  }
  return {
    format: 'inscape-css-inventory',
    version: 1,
    systemVersion: system.version,
    note: 'Generated from production and design-system reference CSS. Reference roles are preview-only. Values remain CSS expressions, with selector and media scopes; this is not a DTCG interchange file. Runtime custom properties and local overrides are included and are not automatically public design tokens.',
    counts: {
      files: sources.length,
      definitions: sources.reduce((count, source) => count + source.definitions.length, 0),
      names: new Set(sources.flatMap((source) => source.definitions.map((token) => token.name)))
        .size,
    },
    sources,
  };
}

export async function checkInventory() {
  const expected = JSON.stringify(await createInventory(), null, 2) + '\n';
  const actual = (await readFile(outputPath, 'utf8')).replaceAll('\r\n', '\n');
  if (expected !== actual)
    throw new Error(
      'Design-system inventory is stale. Run npm run design-system:tokens and review the generated diff.',
    );
  return JSON.parse(expected).counts;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes('--check'))
      console.log('Design-system inventory checked:', await checkInventory());
    else {
      const inventory = await createInventory();
      await writeFile(outputPath, JSON.stringify(inventory, null, 2) + '\n');
      console.log('Design-system inventory generated:', inventory.counts);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
