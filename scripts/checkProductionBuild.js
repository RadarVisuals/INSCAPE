import { resolve } from 'node:path';
import { checkExistingBuild } from './productionBuild.js';

const outputDirectory = resolve(process.argv[2] || 'dist');
try {
  const report = await checkExistingBuild(outputDirectory);
  console.log(`Production budgets passed (${report.totals.initialJavaScript.raw} initial JS bytes).`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
