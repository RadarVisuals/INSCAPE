import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Reviewable application/check inputs. Generated output, Git internals, local
// environments and unrelated experiments are deliberately outside this scope.
export const SOURCE_INPUTS = Object.freeze([
  '.github', '.gitignore', '.node-version', '.npmrc', 'AGENTS.md',
  'package.json', 'package-lock.json', 'vite.config.js', 'netlify.toml',
  'eslint.config.js', '.prettierrc.json', 'tsconfig.contracts.json', 'typechecks',
  'index.html', 'mini-app-host.html', 'design-system.html',
  'src', 'scripts', 'netlify', 'public', 'browser-tests', 'design-system', 'docs',
  'prototypes/visitor-mint',
]);
const protectedName = 'INSCAPE_ALPHA_CONTINUATION_HANDOFF.md';
export const sha256 = value => createHash('sha256').update(value).digest('hex');

export async function fileInventory(root, inputs) {
  const files = [];
  async function visit(relative) {
    const name = relative.split('/').at(-1);
    if (name === protectedName) return; // Never open or hash the protected handoff.
    const absolute = resolve(root, relative);
    const info = await lstat(absolute).catch(error => {
      if (error.code === 'ENOENT' && inputs.includes(relative)) return null;
      throw error;
    });
    if (!info) return;
    if (info.isSymbolicLink()) throw Error(`Symlink in evidence scope: ${relative}`);
    if (info.isDirectory()) {
      for (const entry of (await readdir(absolute)).sort()) await visit(`${relative}/${entry}`);
    } else if (info.isFile()) {
      if (/^\.env(?:\.|$)/u.test(name) || /\.(?:pem|p12|pfx|key)$/iu.test(name))
        throw Error(`Private configuration in evidence scope: ${relative}`);
      const bytes = await readFile(absolute);
      files.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes) });
    }
  }
  for (const input of [...inputs].sort()) await visit(input);
  return { sha256: sha256(JSON.stringify(files)), files };
}

export async function sourceInventory(root) {
  const localEnvironment = (await readdir(root)).some(name => /^\.env(?:\.|$)/u.test(name) && name !== '.env.example');
  if (localEnvironment) throw Error('Verification requires a checkout without local .env files; supply explicit public VITE_* configuration.');
  return fileInventory(root, SOURCE_INPUTS);
}

export function gitIdentity(root) {
  const git = args => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true });
  const top = git(['rev-parse', '--show-toplevel']);
  const normalize = value => process.platform === 'win32' ? value.toLowerCase() : value;
  if (top.status !== 0 || normalize(resolve(top.stdout.trim())) !== normalize(resolve(root)))
    return { commit: null, dirty: null };
  const head = git(['rev-parse', 'HEAD']);
  const status = git(['status', '--porcelain', '-z', '--untracked-files=normal']);
  if (head.status !== 0 || status.status !== 0 || !/^[a-f0-9]{40}$/u.test(head.stdout.trim()))
    throw Error('Unable to determine Git identity');
  return { commit: head.stdout.trim(), dirty: status.stdout.length > 0 };
}

export function passingTap(log) {
  const plans = [...log.matchAll(/^1\.\.([1-9]\d*)\r?$/gm)];
  const points = [...log.matchAll(/^ok (\d+)\b.*$/gm)];
  if ([...log.matchAll(/^TAP version 13\r?$/gm)].length !== 1
    || plans.length !== 1 || points.length !== Number(plans[0][1])
    || points.some((point, index) => Number(point[1]) !== index + 1)
    || /^\s*not ok\b/m.test(log)) throw Error('Missing or incomplete TAP plan/results');
  const fields = ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'];
  const counts = Object.fromEntries(fields.map(key => {
    const matches = [...log.matchAll(new RegExp(`^# ${key} (\\d+)\\r?$`, 'gm'))];
    if (matches.length !== 1) throw Error(`Missing or ambiguous TAP total: ${key}`);
    return [key, Number(matches[0][1])];
  }));
  if (!counts.tests || counts.pass !== counts.tests || fields.slice(2).some(key => counts[key]))
    throw Error(`Incomplete test run: ${JSON.stringify(counts)}`);
  return counts;
}
