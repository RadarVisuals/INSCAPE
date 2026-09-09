import assert from 'node:assert/strict';
import { test } from 'node:test';
import react from '@vitejs/plugin-react';
import { build } from 'vite';

const retainedPrototypeInputs = {
  ownerShell: 'owner-shell-wireframe.html',
  ownerShellSystem: 'owner-shell-system-prototype.html',
};

test('retained standalone owner prototypes keep complete compilable dependency graphs', async () => {
  const output = await build({
    configFile: false,
    build: {
      rollupOptions: { input: retainedPrototypeInputs },
      write: false,
    },
    logLevel: 'silent',
    plugins: [react()],
  });

  const bundles = Array.isArray(output) ? output : [output];
  const emittedFiles = bundles.flatMap((bundle) => bundle.output.map(({ fileName }) => fileName));
  assert.ok(emittedFiles.some((fileName) => fileName.endsWith('.html') && fileName.includes('owner-shell-wireframe')));
  assert.ok(emittedFiles.some((fileName) => fileName.endsWith('.html') && fileName.includes('owner-shell-system-prototype')));
});
