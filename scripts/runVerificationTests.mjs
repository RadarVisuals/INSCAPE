import { run } from 'node:test';
import { tap } from 'node:test/reporters';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Node 24's CLI preloads run in workers, not in the --test coordinator. Use the
// same native discovery and process isolation in an ordinary Node host so its
// start/completion inventory handshake also covers the coordinator lifetime.
export function nativeTestOptions(args) {
  const options = { cwd: process.cwd(), isolation: 'process', concurrency: true, execArgv: [] };
  const files = [];
  let test = false, reporter = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--test' && !test) test = true;
    else if (arg === '--test-reporter=tap' && !reporter) reporter = true;
    else if (/^--test-concurrency=[1-9]\d*$/u.test(arg)) options.concurrency = Number(arg.split('=')[1]);
    else if (arg === '--import' && args[index + 1] && !args[index + 1].startsWith('-')) options.execArgv.push(arg, args[++index]);
    else if (!arg.startsWith('-')) files.push(arg);
    else throw Error(`Unsupported verification test argument: ${arg}`);
  }
  if (!test || !reporter) throw Error('Verification tests require --test and --test-reporter=tap');
  if (files.length) options.files = files;
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const stream = run(nativeTestOptions(process.argv.slice(2)));
  stream.on('test:fail', event => { if (!event.todo && !event.skip) process.exitCode = 1; });
  stream.on('error', error => { console.error(error.message); process.exitCode = 1; });
  stream.compose(tap).pipe(process.stdout);
}
