import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { createBrowserTestServer } from './runBrowserTests.mjs';
import { closeViteWithinDeadline } from '../browser-tests/browser-test-lifecycle.mjs';

test('browser verification disables project file watching while retaining Vite transforms', async () => {
  const temporaryRoot = resolve(tmpdir());
  const root = await mkdtemp(resolve(temporaryRoot, 'inscape-browser-server-'));
  let server;
  try {
    await writeFile(resolve(root, 'vite.config.mjs'), `export default {
      server: { watch: { ignored: ['**/generated/**'] } },
      optimizeDeps: { noDiscovery: true, include: [] },
    };`);
    await writeFile(resolve(root, 'entry.js'), 'export const fixture = "served";');
    let customPluginCalled = false;
    const cacheDir = resolve(root, 'owned-cache');
    server = await createBrowserTestServer(root, 0, { cacheDir, define: { __OWNED_FIXTURE__: 'true' }, plugins: [{
      name: 'fixture-extension', configResolved() { customPluginCalled = true; },
    }] });
    assert.equal(customPluginCalled, true);
    assert.equal(server.config.define.__OWNED_FIXTURE__, 'true');
    assert.equal(resolve(server.config.cacheDir), cacheDir, 'each server retains its own dependency cache');
    assert.equal(server.config.server.watch, null, 'project watch options cannot survive configuration merging');
    const transformed = await server.transformRequest('/entry.js');
    assert.match(transformed.code, /export const fixture = "served"/u);
    assert.deepEqual(server.watcher.getWatched(), {}, 'serving source must not register file watchers');
  } finally {
    await closeViteWithinDeadline(server);
    assert.equal(dirname(root), temporaryRoot);
    await rm(root, { recursive: true, force: true });
  }
});
