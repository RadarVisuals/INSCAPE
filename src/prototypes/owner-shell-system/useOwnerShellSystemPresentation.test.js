import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('presentation lifecycle is isolated behind one prototype-local controller', async () => {
  const [controller, parent] = await Promise.all([
    read('./useOwnerShellSystemPresentation.js'),
    read('./OwnerShellSystemPrototype.jsx'),
  ]);

  assert.match(parent, /useOwnerShellSystemPresentation/);
  assert.match(parent, /beginPresentation\(selectedPlacement\)/);
  assert.match(parent, /onCancelPresentation=\{cancelPresentation\}/);
  assert.doesNotMatch(parent, /setPresentationSession/);
  assert.match(controller, /createOwnerShellSystemPresentationSession/);
  assert.match(controller, /updateOwnerShellSystemPresentationSession/);
  assert.match(controller, /FRAME & MAT CONTROLS \/ NOT CONNECTED/);
  assert.match(controller, /event\.key === 'Escape'/);
});
