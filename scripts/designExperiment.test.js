import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createExperiment } from './designExperiment.mjs';

test('new studies preserve component imports, refuse overwrite and reject path traversal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'inscape-lab-test-'));
  try {
    const directory = join(root, 'design-system/lab/artboards'); await mkdir(directory, { recursive: true });
    const source = 'import RealComponent from "../../../src/RealComponent.jsx";';
    await writeFile(join(directory, 'reception.jsx'), source);
    const file = await createExperiment(root, 'first-study');
    assert.equal(await readFile(file, 'utf8'), source);
    await assert.rejects(createExperiment(root, 'first-study'), { code: 'EEXIST' });
    for (const name of ['../escape', 'C:/escape', 'CON', 'nul', 'with space']) await assert.rejects(createExperiment(root, name));
    await assert.rejects(createExperiment(root, 'valid', '../outside'));
    assert.equal(await readFile(file, 'utf8'), source);
  } finally { await rm(root, { recursive: true, force: true }); }
});
