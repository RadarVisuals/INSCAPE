import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { validateOutputDirectory } from './buildDesignSystem.js';

test('visual export accepts only its dedicated output or a declared Site dist', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'inscape-visual-build-'));
  try {
    await assert.rejects(validateOutputDirectory(temporary));
    await mkdir(join(temporary, '.openai'));
    await writeFile(
      join(temporary, '.openai', 'hosting.json'),
      JSON.stringify({ project_id: 'test-only', static: { directory: 'dist' } }),
    );
    const output = join(temporary, 'dist');
    assert.equal(await validateOutputDirectory(output), resolve(output));
    await assert.rejects(validateOutputDirectory(join(temporary, 'source')), /External output/);
    await writeFile(output, 'owned file, not a generated directory');
    await assert.rejects(validateOutputDirectory(output), /non-directory/);
  } finally {
    // This exact directory is owned by mkdtemp above, never supplied by a build caller.
    await rm(temporary, { recursive: true, force: true });
  }
});
