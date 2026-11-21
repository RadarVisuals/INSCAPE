import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const out = path.resolve(import.meta.dirname);
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const excluded = p => p.includes('INSCAPE_ALPHA_CONTINUATION_HANDOFF.md') || p.includes('reception-reaudit-styling/');
const hash = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
if (process.argv.includes('--verify')) {
  const before = JSON.parse(fs.readFileSync(path.join(out, 'baseline.json')));
  const changes = Object.entries(before.hashes).filter(([p,h]) => !fs.existsSync(p) || hash(p) !== h);
  fs.writeFileSync(path.join(out, 'preservation.json'), JSON.stringify({ checked: Object.keys(before.hashes).length, changes, head: git('rev-parse','HEAD'), progressSha256: hash('docs/audits/2026-10-23/code-quality-progress.json') }, null, 2));
  console.log({ checked: Object.keys(before.hashes).length, changes });
} else {
  const files = [...new Set([...git('ls-files').split('\n'), ...git('ls-files','--others','--exclude-standard','--','src','scripts','browser-tests','docs/audits/2026-10-27/reception-audit-remediation','docs/audits/2026-10-27/reception-boundaries-audit').split('\n')])].filter(p => p && !excluded(p) && fs.existsSync(p));
  fs.writeFileSync(path.join(out, 'baseline.json'), JSON.stringify({ capturedAt: new Date().toISOString(), branch: git('branch','--show-current'), head: git('rev-parse','HEAD'), status: git('status','--short','--untracked-files=normal').split('\n').filter(p=>!excluded(p)), hashes: Object.fromEntries(files.map(p => [p,hash(p)])) }, null, 2), { flag:'wx' });
  console.log({ captured: files.length });
}
