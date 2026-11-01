export const BROWSER_SHARDS = 4;
// Watchdogs bound an unresponsive process, not individual test expectations.
// The slowest of 85 completed CI suites (run 40775463649) took 111.137 seconds.
export const SUITE_TIMEOUT_MS = 600_000;
export const STEP_TIMEOUT_MS = 900_000;
export const verificationSteps = Object.freeze([
  { name: 'browser-catalog', group: 'source', args: ['scripts/browserSuiteCatalog.mjs'] },
  { name: 'lint', group: 'source', args: ['scripts/lintSource.mjs'] },
  { name: 'typecheck', group: 'source', args: ['typechecks/verify-workbench-contracts.mjs'] },
  // Keep native discovery and process isolation, but bound concurrent test files:
  // CPU-count defaults overload nested Windows ownership inventories under load.
  { name: 'unit', group: 'source', args: ['--test', '--test-reporter=tap', '--test-concurrency=4'], tap: true },
  { name: 'standards', group: 'source', args: ['--test', '--test-reporter=tap', 'scripts/luksoStandards.audit.test.js'], tap: true },
  { name: 'design-system', group: 'source', args: ['scripts/designSystemInventory.js', '--check'] },
  { name: 'browser', group: 'browser', args: ['scripts/runBrowserTests.mjs'] },
  { name: 'build', group: 'production', args: ['node_modules/vite/bin/vite.js', 'build'] },
  { name: 'build-budget', group: 'production', args: ['scripts/checkProductionBuild.js'] },
  { name: 'production-startup', group: 'production', args: ['--import', './scripts/browserEnvironment.mjs', '--test', '--test-reporter=tap', 'browser-tests/production-startup.browser.mjs'], tap: true },
]);

export function verificationPlan(scope = 'full', shard) {
  if (!['full', 'source', 'production', 'browser'].includes(scope)) throw Error(`Unknown verification scope: ${scope}`);
  if (scope === 'browser' && (!Number.isInteger(shard) || shard < 1 || shard > BROWSER_SHARDS)) throw Error('Browser scope requires shard 1–4');
  if (scope !== 'browser' && shard !== undefined) throw Error('Shard is only valid for browser scope');
  return verificationSteps.filter(step => scope === 'full' || step.group === scope)
    .map(step => ({ ...step, args: scope === 'browser' ? [...step.args, `--shard=${shard}/${BROWSER_SHARDS}`] : [...step.args] }));
}

export function parseVerificationArgs(args) {
  if (!args.length) return { scope: 'full' };
  if (args.length === 1 && ['--scope=source', '--scope=production'].includes(args[0])) return { scope: args[0].slice(8) };
  if (args.length === 2 && args[0] === '--scope=browser' && /^--shard=[1-4]$/u.test(args[1])) return { scope: 'browser', shard: Number(args[1].at(-1)) };
  throw Error('Use no arguments, --scope=source, --scope=production, or --scope=browser --shard=1–4');
}
