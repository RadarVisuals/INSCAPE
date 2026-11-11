import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
const read = path => readFile(new URL(path, import.meta.url), 'utf8');

// Static entrypoint and dependency restrictions. Executable UI coverage is
// recorded in the step-26 mapping, rather than callback-name assertions.
test('production owner entrypoint excludes development runtimes and prototype dependencies', async () => {
  const [selection, loader, isolation, productionBuild, main] = await Promise.all([
    read('./ownerRuntimeSelected.js'), read('./ownerRuntimeLoader.js'),
    read('../../scripts/ownerRuntimeIsolation.js'), read('../../scripts/productionBuild.js'), read('../main.jsx'),
  ]);
  assert.match(selection, /import\(['"]\.\/OwnerSystemWorkflowShell\.jsx['"]\)/);
  assert.doesNotMatch(loader, /selectOwnerRuntimeImporter|MODUL8R|\bLATTICE\b|\bLEGACY\b/u);
  assert.match(isolation, /OwnerSystemWorkflowShell\.jsx/);
  assert.match(productionBuild, /src\/public\/OwnerSystemWorkflowShell\.jsx/);
  assert.match(main, /import\.meta\.env\.DEV[\s\S]*\/development\/owner\/system-workflow/);
  const names = (await readdir(new URL('./ownerSystemWorkflow/', import.meta.url)))
    .filter(name => /\.(?:js|jsx)$/.test(name) && !name.endsWith('.test.js') && name !== 'OwnerSystemWorkflowDevelopmentEntrance.jsx');
  const sources = await Promise.all([read('./OwnerSystemWorkflowShell.jsx'), ...names.map(name => read('./ownerSystemWorkflow/' + name))]);
  for (const source of sources) {
    assert.doesNotMatch(source, /src\/prototypes|\.\.\/prototypes|prototype\/owner-shell-system/iu);
    assert.doesNotMatch(source, /lattice\/modul8r|Modul8rLibrary/iu);
    assert.doesNotMatch(source, /(?:localStorage|sessionStorage)\.(?:setItem|removeItem)/u,
      'the shell delegates persistence to its scoped stores');
  }
});
