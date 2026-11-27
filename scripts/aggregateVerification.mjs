import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileInventory, sourceInventory } from './releaseEvidence.mjs';
import { assertEvidencePath, verificationIdentity } from './verificationIdentity.mjs';
import { BROWSER_SHARDS } from './verificationPlan.mjs';
import { loadBrowserSuiteCatalog, browserSelection, selectBrowserSuites } from './browserSuiteCatalog.mjs';
import { assertIdentity, validateBrowserEvidence, validatePartition } from './verificationEvidence.mjs';
const json = async path => JSON.parse(await readFile(path, 'utf8'));

export async function aggregateVerification({ root, input, build, output, environment = process.env, jobs }) {
  assertEvidencePath(root, output);
  await mkdir(dirname(output), { recursive: true }); await mkdir(output);
  const report = { version: 2, scope: 'aggregate', status: 'running', releaseValidated: false, startedAt: new Date().toISOString() };
  try {
    assert.deepEqual(Object.keys(jobs || {}).sort(), ['browser', 'production', 'source'], 'Missing or extra required job');
    for (const [name, job] of Object.entries(jobs)) assert.equal(job.result, 'success', `Required job ${name} did not succeed`);
    const { source, identity } = await verificationIdentity(root, environment);
    Object.assign(report, identity);
    const catalog = await loadBrowserSuiteCatalog(root), attempt = identity.ci?.attempt || 'local';
    const parts = [{ scope: 'source' }, { scope: 'production' }, ...Array.from({ length: BROWSER_SHARDS }, (_, index) => ({ scope: 'browser', shard: index + 1 }))];
    const partName = ({ scope, shard }) => `verification-${scope}${shard ? `-${shard}` : ''}-${attempt}`;
    assert.deepEqual((await readdir(input)).sort(), parts.map(partName).sort(), 'Missing, extra or duplicate verification artifact');
    const seen = [], summaries = [];
    let production;
    for (const part of parts) {
      const folder = resolve(input, partName(part)), summary = await json(resolve(folder, 'verification.json'));
      await validatePartition(summary, { ...part, output: folder, identity });
      assert.deepEqual(await json(resolve(folder, 'source-manifest.json')), source, 'Partition source manifest differs from current checkout');
      summaries.push({ ...part, artifact: partName(part), finishedAt: summary.finishedAt });
      if (part.scope === 'production') production = summary;
      if (part.scope === 'browser') {
        const browserFolder = resolve(folder, 'browser'), browser = await json(resolve(browserFolder, 'browser.json'));
        const selection = browserSelection(catalog, [`--shard=${part.shard}/${BROWSER_SHARDS}`]);
        await validateBrowserEvidence(browser, { output: browserFolder, selection, identity });
        assertIdentity(browser.identity, summary, { browser: true });
        assertIdentity(browser.identity, production, { browser: true });
        assert.deepEqual(await json(resolve(browserFolder, 'source-manifest.json')), source, 'Browser source manifest differs from current checkout');
        seen.push(...browser.results.map(result => result.name));
      }
    }
    assert.equal(new Set(seen).size, seen.length, 'Duplicate browser suite across shards');
    assert.deepEqual([...seen].sort(), selectBrowserSuites(catalog).sort(), 'Incomplete release browser coverage');
    const artifacts = await fileInventory(build, await readdir(build));
    const productionManifest = await json(resolve(input, partName({ scope: 'production' }), 'artifact-manifest.json'));
    assert.deepEqual(artifacts, productionManifest, 'Downloaded production bytes differ from tested artifact');
    assert.equal(artifacts.sha256, production.artifactSha256, 'Production artifact identity mismatch');
    assert.equal(artifacts.sha256, production.candidateArtifactSha256, 'Production bytes changed since the build checkpoint');
    assert.deepEqual(await json(resolve(input, partName({ scope: 'production' }), 'candidate-artifact-manifest.json')), artifacts,
      'Build checkpoint differs from tested production bytes');
    assert.ok(artifacts.files.some(file => file.path === 'index.html'), 'Production entry is missing');
    const candidate = await json(resolve(build, 'release-identity.json'));
    assert.equal(candidate.version, 2); assert.equal(candidate.validation, 'candidate');
    for (const field of ['sourceSha256', 'lockfileSha256', 'publicConfigurationSha256']) assert.equal(candidate[field], identity[field], `Build ${field} mismatch`);
    assert.equal(candidate.commit, identity.git.commit); assert.equal(candidate.dirty, identity.git.dirty); assert.deepEqual(candidate.ci, identity.ci);
    if ((await sourceInventory(root)).sha256 !== identity.sourceSha256) throw Error('Source changed during aggregation');
    Object.assign(report, { status: 'passed', releaseValidated: true, artifactSha256: artifacts.sha256,
      browserSuites: seen.length, partitions: summaries, runtime: production.runtime });
    await writeFile(resolve(output, 'source-manifest.json'), JSON.stringify(source, null, 2));
    await writeFile(resolve(output, 'artifact-manifest.json'), JSON.stringify(artifacts, null, 2));
  } catch (error) { report.status = 'failed'; report.error = error.message; console.error(error.message); }
  finally { report.finishedAt = new Date().toISOString(); await writeFile(resolve(output, 'verification.json'), JSON.stringify(report, null, 2)); }
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, '..');
  try {
    if (process.argv.length !== 2) throw Error('Aggregator takes paths only through its explicit environment');
    const result = await aggregateVerification({ root,
      input: resolve(process.env.INSCAPE_VERIFY_INPUT || '.verification/incoming'),
      build: resolve(process.env.INSCAPE_VERIFY_BUILD || '.verification/build'),
      output: resolve(process.env.INSCAPE_VERIFY_REPORT || '.verification/aggregate'),
      jobs: JSON.parse(process.env.INSCAPE_VERIFY_JOBS || 'null') });
    if (result.status !== 'passed') process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
